class GCodeParser {
    constructor() {
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.layers = [];
        this.currentLayer = null;
        this.retractionZ = null;
    }

    parse(gcode) {
        const lines = gcode.split('\n');
        for (let line of lines) {
            this.processLine(line);
        }
        return this.layers;
    }

    processLine(line) {
        if (line.trim() === '') return;

        const type = this.classifyLine(line);
        const newPosition = { ...this.currentPosition };

        if (type === 'movement' || type === 'arc') {
            if (type === 'arc') {
                this.processArcMovement(line, newPosition);
            } else {
                this.processMovement(line, newPosition);
            }
        } else {
            this.handleNonMovement(type, newPosition);
        }

        this.currentPosition = newPosition;
    }

    classifyLine(line) {
        const commandMap = {
            'G0': 'movement', 'G1': 'movement',
            'G2': 'arc', 'G3': 'arc',
            'G92': 'reset', 'M600': 'pause', 'M601': 'pause',
            'M83': 'extrusion', 'M84': 'extrusion',
            'G90': 'coordinate_mode', 'G91': 'coordinate_mode',
            'G10': 'retraction', 'G11': 'retraction',
            'G1 Z': 'wipe', 'G1 X': 'outerwall', 'G1 Y': 'outerwall',
        };

        // Extract the command code (e.g., G0, G1, G92) from the line
        const commandCode = line.split(' ')[0];

        // Use the command code to find the corresponding type
        return commandMap[commandCode] || 'unknown';
    }

    processMovement(line, type) {
        const newPosition = { ...this.currentPosition };
        let parts = line.split(' ');

        parts.forEach(part => {
            let code = part.charAt(0);
            let value = parseFloat(part.substring(1));
            if (code === 'X' || code === 'Y' || code === 'Z') {
                newPosition[code.toLowerCase()] = value;
            }
        });

        if (type === 'arc') {
            this.processArcMovement(newPosition, parts, line);
        } else {
            this.updateLayer(newPosition);
        }

        // Update currentPosition to the end of the movement
        this.currentPosition = { ...newPosition };
    }

    processArcMovement(line, newPosition) {
        let parts = line.split(' ');
        let centerX, centerY, isClockwise;
        isClockwise = line.startsWith('G2');

        for (let part of parts) {
            if (part.startsWith('X')) {
                newPosition.x = parseFloat(part.substring(1));
            } else if (part.startsWith('Y')) {
                newPosition.y = parseFloat(part.substring(1));
            } else if (part.startsWith('I')) {
                centerX = this.currentPosition.x + parseFloat(part.substring(1));
            } else if (part.startsWith('J')) {
                centerY = this.currentPosition.y + parseFloat(part.substring(1));
            }
        }

        // Check for valid center coordinates
        if (isNaN(centerX) || isNaN(centerY)) {
            console.error('Invalid center for arc movement:', line);
            return;
        }

        const radius = Math.sqrt(Math.pow(centerX - this.currentPosition.x, 2) + Math.pow(centerY - this.currentPosition.y, 2));

        // Check for valid radius
        if (isNaN(radius) || radius <= 0) {
            console.error('Invalid radius for arc movement:', line);
            return;
        }

        const startAngle = Math.atan2(this.currentPosition.y - centerY, this.currentPosition.x - centerX);
        const endAngle = Math.atan2(newPosition.y - centerY, newPosition.x - centerX);
        let angleDiff = isClockwise ? startAngle - endAngle : endAngle - startAngle;

        // Normalize the angle difference
        if (angleDiff < 0) {
            angleDiff += 2 * Math.PI;
        }
        if (isClockwise && angleDiff > 0) {
            angleDiff -= 2 * Math.PI;
        }

        const segmentLength = 1; // mm, adjust as needed
        const circumference = Math.abs(angleDiff) * radius;
        const numSegments = Math.max(Math.ceil(circumference / segmentLength), 1);

        // Generate the points along the arc
        for (let i = 1; i <= numSegments; i++) {
            let fraction = i / numSegments;
            let angle = startAngle + angleDiff * fraction;
            let x = centerX + radius * Math.cos(angle);
            let y = centerY + radius * Math.sin(angle);

            // Validate each point before adding
            if (!isNaN(x) && !isNaN(y)) {
                if (this.currentLayer) {
                    this.currentLayer.movements.push({
                        from: { ...this.currentPosition },
                        to: { x: x, y: y, z: this.currentPosition.z },
                        center: { x: centerX, y: centerY },
                        radius: radius,
                        isClockwise: isClockwise
                    });
                }

                this.currentPosition.x = x;
                this.currentPosition.y = y;
            } else {
                console.error('Invalid arc segment position:', x, y);
            }
        }

        // After the loop, ensure currentPosition is set to the end of the arc
        this.currentPosition = { ...newPosition };
    }



    updateLayer(newPosition) {
        if (!this.currentLayer || newPosition.z !== this.currentLayer.z) {
            this.currentLayer = this.getOrCreateLayer(newPosition.z);
        }

        if (this.currentLayer) {
            this.currentLayer.movements.push({
                from: { ...this.currentPosition },
                to: { ...newPosition }
            });
        }

        this.currentPosition = newPosition;
    }

    handleNonMovement(line, type) {
        const newPosition = { ...this.currentPosition };

        // Handling for different non-movement commands can be expanded here
        if (type === 'retraction') {
            this.retractionZ = newPosition.z;
        } else if (type === 'wipe' && this.retractionZ !== null) {
            this.currentLayer = this.getOrCreateLayer(this.retractionZ);
            this.retractionZ = null;
        }
    }

    getOrCreateLayer(z) {
        let layer = this.layers.find(layer => layer.z === z);
        if (!layer) {
            layer = { z, movements: [] };
            this.layers.push(layer);
        }
        return layer;
    }
}

export { GCodeParser };
