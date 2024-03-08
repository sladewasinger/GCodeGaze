class GCodeParser {
    constructor() {
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.layers = [];
        this.currentLayer = null;
        this.firstExtrusionOccurred = false;
    }

    parse(gcode) {
        const lines = gcode.split('\n');
        lines.forEach(line => this.processLine(line));
        return this.layers;
    }

    processLine(line) {
        if (line.trim() === '') return;

        const type = this.classifyLine(line);
        const newPosition = { ...this.currentPosition };

        switch (type) {
            case 'movement':
                this.processMovement(line, newPosition);
                break;
            case 'arc':
                this.processArcMovement(line, newPosition);
                break;
            default:
                this.handleNonMovement(line, type);
        }

        this.currentPosition = { ...newPosition };
    }

    classifyLine(line) {
        const commandCode = line.split(' ')[0];
        return GCodeParser.commandMap[commandCode] || 'unknown';
    }

    processMovement(line, newPosition) {
        const parts = line.split(' ');

        let isExtruding = false;
        let hasMovement = false;
        parts.forEach(part => {
            const code = part.charAt(0);
            const value = parseFloat(part.substring(1));
            if (['X', 'Y', 'Z'].includes(code)) {
                hasMovement = true;
                newPosition[code.toLowerCase()] = value;
            }
            if (code === 'E' && value > 0 && hasMovement) {
                isExtruding = true;
                this.firstExtrusionOccurred = true;
            }
        });

        this.updateLayer(newPosition, isExtruding);
    }

    processArcMovement(line, newPosition) {
        const parts = line.split(' ');
        const isClockwise = line.startsWith('G2');
        let centerX, centerY;

        parts.forEach(part => {
            const code = part.charAt(0);
            const value = parseFloat(part.substring(1));
            switch (code) {
                case 'X':
                    newPosition.x = value;
                    break;
                case 'Y':
                    newPosition.y = value;
                    break;
                case 'I':
                    centerX = this.currentPosition.x + value;
                    break;
                case 'J':
                    centerY = this.currentPosition.y + value;
                    break;
            }
        });

        if (isNaN(centerX) || isNaN(centerY)) {
            console.error('Invalid center for arc movement:', line);
            return;
        }

        const radius = Math.hypot(centerX - this.currentPosition.x, centerY - this.currentPosition.y);
        if (isNaN(radius) || radius <= 0) {
            console.error('Invalid radius for arc movement:', line);
            return;
        }

        const startAngle = Math.atan2(this.currentPosition.y - centerY, this.currentPosition.x - centerX);
        const endAngle = Math.atan2(newPosition.y - centerY, newPosition.x - centerX);
        let angleDiff = endAngle - startAngle;

        if (isClockwise) {
            if (angleDiff > 0) {
                angleDiff -= 2 * Math.PI;
            }
        } else {
            if (angleDiff < 0) {
                angleDiff += 2 * Math.PI;
            }
        }

        const segmentLength = radius * Math.abs(angleDiff) / Math.ceil(radius * Math.abs(angleDiff) / 10); // Aim for about 10 segments per arc as a default
        const numSegments = Math.max(Math.ceil(radius * Math.abs(angleDiff) / segmentLength), 1);

        for (let i = 1; i <= numSegments; i++) {
            const fraction = i / numSegments;
            const angle = startAngle + fraction * angleDiff;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            if (!isNaN(x) && !isNaN(y)) {
                if (this.currentLayer) {
                    this.currentLayer.movements.push({
                        from: { ...this.currentPosition },
                        to: { x, y, z: this.currentPosition.z },
                        center: { x: centerX, y: centerY },
                        radius: radius,
                        isClockwise: isClockwise
                    });
                }

                this.currentPosition = { x, y, z: this.currentPosition.z };
            } else {
                console.error('Invalid arc segment position:', x, y);
            }
        }
    }

    updateLayer(newPosition, isExtruding) {
        if (!this.currentLayer) {
            this.currentLayer = this.createNewLayer();
        }

        if (this.firstExtrusionOccurred && newPosition.z !== this.currentLayer.z) {
            this.currentLayer = this.createNewLayer(newPosition.z);
        }

        if (this.currentLayer) {
            this.currentLayer.movements.push({
                from: { ...this.currentPosition },
                to: { ...newPosition },
                isExtruding: isExtruding,
            });
        }
    }

    createNewLayer(z) {
        const layer = {
            z: z,
            movements: [],
        };
        this.layers.push(layer);
        return layer;
    }

    handleNonMovement(line, type) {
        switch (type) {
            case 'retraction':
            case 'wipe':
                // Ignore retraction and wipe commands
                break;
            // Handle other non-movement commands if needed
        }
    }

    static commandMap = {
        'G0': 'movement', 'G1': 'movement',
        'G2': 'arc', 'G3': 'arc',
        'G92': 'reset', 'M600': 'pause', 'M601': 'pause',
        'M83': 'extrusion', 'M84': 'extrusion',
        'G90': 'coordinate_mode', 'G91': 'coordinate_mode',
        'G10': 'retraction', 'G11': 'retraction',
        'G1 Z': 'wipe', 'G1 X': 'outerwall', 'G1 Y': 'outerwall',
    };
}
export { GCodeParser };
