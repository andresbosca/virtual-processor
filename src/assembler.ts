export class Assembler {
  private static readonly OPCODES: { [key: string]: number } = {
    MOV: 0x00,
    LOAD: 0x01,
    ADD: 0x02,
    SUB: 0x03,
    MUL: 0x04,
    DIV: 0x05,
    JMP: 0x06,
    JZ: 0x07,
    JN: 0x08,
    JP: 0x09,
    IN: 0x10,
    OUT: 0x11,
    LOADM: 0x12,
    STOREM: 0x13,
    CALL: 0x14,
    RET: 0x15,
    HLT: 0xff,
  };

  private static parseRegister(reg: string): number {
    const match = reg.match(/^R([0-3])$/i);
    if (!match) {
      throw new Error(`Invalid register: ${reg}`);
    }
    return parseInt(match[1]);
  }

  private static parseNumber(num: string): number {
    if (num.startsWith('0x') || num.startsWith('0X')) {
      return parseInt(num, 16);
    }
    return parseInt(num, 10);
  }

  private static parseMemoryAddress(addr: string): number {
    // Remove brackets [addr] -> addr
    const cleaned = addr.replace(/[\[\]]/g, '');
    return this.parseNumber(cleaned);
  }

  static assemble(program: string): number[] {
    // Processa linha por linha removendo comentários
    const lines = program
      .split('\n')
      .map((line) => {
        const commentIndex = line.indexOf(';');
        if (commentIndex !== -1) {
          line = line.substring(0, commentIndex);
        }
        return line.trim();
      })
      .filter((line) => line.length > 0);

    const machineCode: number[] = [];
    const labels: { [key: string]: number } = {};

    // First pass: collect labels
    let address = 0;
    for (const line of lines) {
      if (line.endsWith(':')) {
        const label = line.slice(0, -1).trim();
        labels[label] = address;
      } else {
        address++;
      }
    }

    // Second pass: generate machine code
    for (const line of lines) {
      if (line.endsWith(':')) {
        continue;
      }

      const parts = line.split(/[\s,]+/).filter((p) => p.length > 0);
      if (parts.length === 0) continue;

      const instruction = parts[0].toUpperCase();

      if (!this.OPCODES.hasOwnProperty(instruction)) {
        throw new Error(`Unknown instruction: ${instruction} in line: ${line}`);
      }

      const baseOpcode = this.OPCODES[instruction];
      let machineInstruction = 0;

      console.log({
        instruction,
        baseOpcode,
        parts,
        labels,
      });

      try {
        switch (instruction) {
          case 'MOV': // 00XY - MOV Rx, Ry
            if (parts.length !== 3) {
              throw new Error(`MOV requires 2 operands: ${line}`);
            }
            const regX = this.parseRegister(parts[1]);
            const regY = this.parseRegister(parts[2]);
            machineInstruction =
              (((baseOpcode << 4) | regX) << 8) | (regY << 4);
            break;

          case 'LOAD': // 01Xn - LOAD Rx, n
            if (parts.length !== 3) {
              throw new Error(`LOAD requires 2 operands: ${line}`);
            }
            const loadReg = this.parseRegister(parts[1]);
            const value =
              labels[parts[2]] !== undefined
                ? labels[parts[2]]
                : this.parseValue(parts[2]);
            machineInstruction =
              (((baseOpcode << 4) | loadReg) << 8) | (value & 0xff);
            break;

          case 'ADD': // 02XY - ADD Rx, Ry
          case 'SUB': // 03XY - SUB Rx, Ry
          case 'MUL': // 04XY - MUL Rx, Ry
          case 'DIV': // 05XY - DIV Rx, Ry
            if (parts.length !== 3) {
              throw new Error(`${instruction} requires 2 operands: ${line}`);
            }
            const arithRegX = this.parseRegister(parts[1]);
            const arithRegY = this.parseRegister(parts[2]);
            machineInstruction =
              (((baseOpcode << 4) | arithRegX) << 8) | (arithRegY << 4);
            break;

          case 'JMP': // 06Xa - JMP a
            if (parts.length !== 2) {
              throw new Error(`JMP requires 1 operand: ${line}`);
            }
            const jumpAddr =
              labels[parts[1]] !== undefined
                ? labels[parts[1]]
                : this.parseNumber(parts[1]);
            machineInstruction = (baseOpcode << 12) | (jumpAddr & 0xfff);
            break;

          case 'JZ': // 07Xn - JZ Rx, n
          case 'JN': // 08Xn - JN Rx, n
          case 'JP': // 09Xn - JP Rx, n
            if (parts.length !== 3) {
              throw new Error(`${instruction} requires 2 operands: ${line}`);
            }
            const condReg = this.parseRegister(parts[1]);
            const condAddr =
              labels[parts[2]] !== undefined
                ? labels[parts[2]]
                : this.parseNumber(parts[2]);
            machineInstruction =
              (((baseOpcode << 4) | condReg) << 8) | (condAddr & 0xff);
            break;

          case 'IN': // 10Xx - IN Rx
          case 'OUT': // 11Xx - OUT Rx
            if (parts.length !== 2) {
              throw new Error(`${instruction} requires 1 operand: ${line}`);
            }
            const ioReg = this.parseRegister(parts[1]);
            console.log({
              text: `IO Register: ${ioReg}`,
              value: ioReg,
              baseOpcode,
              instruction,
            });

            machineInstruction = (baseOpcode << 8) | (ioReg << 4);
            break;

          case 'LOADM': // 12Xa - LOADM Rx, [a]
            if (parts.length !== 3) {
              throw new Error(`LOADM requires 2 operands: ${line}`);
            }
            const loadmReg = this.parseRegister(parts[1]);
            const loadmAddr = this.parseMemoryAddress(parts[2]);
            machineInstruction =
              (((baseOpcode << 4) | loadmReg) << 8) | (loadmAddr & 0xff);
            break;

          case 'STOREM': // 13aX - STOREM [a], Rx
            if (parts.length !== 3) {
              throw new Error(`STOREM requires 2 operands: ${line}`);
            }
            const storeAddr = this.parseMemoryAddress(parts[1]);
            const storeReg = this.parseRegister(parts[2]);
            machineInstruction =
              (baseOpcode << 12) | ((storeAddr & 0xff) << 4) | storeReg;
            break;

          case 'CALL': // 14ab - CALL ab
            if (parts.length !== 2) {
              throw new Error(`CALL requires 1 operand: ${line}`);
            }
            const callAddr =
              labels[parts[1]] !== undefined
                ? labels[parts[1]]
                : this.parseNumber(parts[1]);
            machineInstruction = (baseOpcode << 12) | (callAddr & 0xfff);
            break;

          case 'RET': // 15 - RET
            machineInstruction = baseOpcode << 8;
            break;

          case 'HLT': // FF - HLT
            machineInstruction = baseOpcode << 8;
            break;

          default:
            throw new Error(`Unhandled instruction: ${instruction}`);
        }

        machineCode.push(machineInstruction);
        console.log(
          `Assembled: ${line} -> 0x${machineInstruction.toString(16).padStart(4, '0').toUpperCase()}`,
        );
      } catch (error: any) {
        throw new Error(`Error in line "${line}": ${error.message}`);
      }
    }

    return machineCode;
  }

  private static parseValue(value: string): number {
    // Se é um caractere entre aspas simples: 'I', 'A', etc.
    if (value.startsWith("'") && value.endsWith("'") && value.length === 3) {
      return value.charCodeAt(1); // Retorna o código ASCII do caractere
    }

    // Se é um número (decimal ou hex), trata como código ASCII
    let numValue: number;

    if (value.startsWith('0x') || value.startsWith('0X')) {
      numValue = parseInt(value, 16);
    } else {
      numValue = parseInt(value, 10);
    }

    // Sempre retorna o caractere correspondente ao código ASCII
    return numValue; // O número já É o código ASCII
  }

  static disassemble(machineCode: number[]): string {
    const result: string[] = [];

    for (let i = 0; i < machineCode.length; i++) {
      const instruction = machineCode[i];
      const opcode = (instruction & 0xff00) >> 8;
      const operand = instruction & 0x00ff;

      let line = `${i.toString().padStart(3, '0')}: 0x${instruction
        .toString(16)
        .padStart(4, '0')
        .toUpperCase()} `;

      const baseOp = (opcode & 0xf0) >> 4;
      const regX = opcode & 0x0f;
      console.log({
        instruction,
        opcode,
        operand,
        baseOp,
        regX,
      });
      switch (baseOp) {
        case 0x0: // MOV
          line += `MOV R${regX}, R${(operand & 0xf0) >> 4}`;
          break;
        case 0x1: // LOAD
          line += `LOAD R${regX}, ${operand}`;
          break;
        case 0x2: // ADD
          line += `ADD R${regX}, R${(operand & 0xf0) >> 4}`;
          break;
        case 0x3: // SUB
          line += `SUB R${regX}, R${(operand & 0xf0) >> 4}`;
          break;
        case 0x4: // MUL
          line += `MUL R${regX}, R${(operand & 0xf0) >> 4}`;
          break;
        case 0x5: // DIV
          line += `DIV R${regX}, R${(operand & 0xf0) >> 4}`;
          break;
        case 0x6: // JMP
          line += `JMP ${instruction & 0x0fff}`;
          break;
        case 0x7: // JZ
          line += `JZ R${regX}, ${operand}`;
          break;
        case 0x8: // JN
          line += `JN R${regX}, ${operand}`;
          break;
        case 0x9: // JP
          line += `JP R${regX}, ${operand}`;
          break;
        default:
          if (opcode === 0x10) {
            line += `IN R${(operand & 0xf0) >> 4}`;
          } else if (opcode === 0x11) {
            line += `OUT R${(operand & 0xf0) >> 4}`;
          } else if ((opcode & 0xf0) === 0x10 && (opcode & 0x0f) === 0x02) {
            line += `LOADM R${regX}, [${operand}]`;
          } else if ((opcode & 0xf0) === 0x10 && (opcode & 0x0f) === 0x03) {
            line += `STOREM [${(operand & 0xf0) >> 4}], R${operand & 0x0f}`;
          } else if ((opcode & 0xf0) === 0x10 && (opcode & 0x0f) === 0x04) {
            line += `CALL ${instruction & 0x0fff}`;
          } else if (opcode === 0x15) {
            line += `RET`;
          } else if (opcode === 0xff) {
            line += `HLT`;
          } else {
            line += `UNKNOWN`;
          }
      }

      result.push(line);
    }

    return result.join('\n');
  }
}
