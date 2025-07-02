export class Assembler {
  private static readonly OPCODES: { [key: string]: number } = {
    MOV: 0x0, // 0000
    LOAD: 0x1, // 0001
    ADD: 0x2, // 0010
    SUB: 0x3, // 0011
    MUL: 0x4, // 0100
    DIV: 0x5, // 0101
    JMP: 0x6, // 0110
    JZ: 0x7, // 0111
    JN: 0x8, // 1000
    JP: 0x9, // 1001
    IN: 0xa, // 1010
    OUT: 0xb, // 1011
    LOADM: 0xc, // 1100
    STOREM: 0xd, // 1101
    CALL: 0xe, // 1110
    RET: 0xf0, // 11110000
    HLT: 0xff, // 11111111
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
    const cleaned = addr.replace(/[\[\]]/g, '');
    return this.parseNumber(cleaned);
  }

  private static parseValue(value: string): number {
    if (value.startsWith("'") && value.endsWith("'") && value.length === 3) {
      return value.charCodeAt(1);
    }

    if (value.startsWith('0x') || value.startsWith('0X')) {
      return parseInt(value, 16);
    }
    return parseInt(value, 10);
  }

  static assemble(program: string): number[] {
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

      try {
        switch (instruction) {
          case 'MOV': // 0XYZ - MOV Rx, Ry
            if (parts.length !== 3) {
              throw new Error(`MOV requires 2 operands: ${line}`);
            }
            const regX = this.parseRegister(parts[1]);
            const regY = this.parseRegister(parts[2]);
            machineInstruction = (baseOpcode << 12) | (regX << 8) | (regY << 4);
            break;

          case 'LOAD': // 1Xnn - LOAD Rx, n
            if (parts.length !== 3) {
              throw new Error(`LOAD requires 2 operands: ${line}`);
            }
            const loadReg = this.parseRegister(parts[1]);
            const value =
              labels[parts[2]] !== undefined
                ? labels[parts[2]]
                : this.parseValue(parts[2]);
            machineInstruction =
              (baseOpcode << 12) | (loadReg << 8) | (value & 0xff);
            break;

          case 'ADD': // 2XYZ - ADD Rx, Ry
          case 'SUB': // 3XYZ - SUB Rx, Ry
          case 'MUL': // 4XYZ - MUL Rx, Ry
          case 'DIV': // 5XYZ - DIV Rx, Ry
            if (parts.length !== 3) {
              throw new Error(`${instruction} requires 2 operands: ${line}`);
            }
            const arithRegX = this.parseRegister(parts[1]);
            const arithRegY = this.parseRegister(parts[2]);
            machineInstruction =
              (baseOpcode << 12) | (arithRegX << 8) | (arithRegY << 4);
            break;

          case 'JMP': // 6aaa - JMP a
            if (parts.length !== 2) {
              throw new Error(`JMP requires 1 operand: ${line}`);
            }
            const jumpAddr =
              labels[parts[1]] !== undefined
                ? labels[parts[1]]
                : this.parseNumber(parts[1]);
            machineInstruction = (baseOpcode << 12) | (jumpAddr & 0xfff);
            break;

          case 'JZ': // 7Xaa - JZ Rx, a
          case 'JN': // 8Xaa - JN Rx, a
          case 'JP': // 9Xaa - JP Rx, a
            if (parts.length !== 3) {
              throw new Error(`${instruction} requires 2 operands: ${line}`);
            }
            const condReg = this.parseRegister(parts[1]);
            const condAddr =
              labels[parts[2]] !== undefined
                ? labels[parts[2]]
                : this.parseNumber(parts[2]);
            machineInstruction =
              (baseOpcode << 12) | (condReg << 8) | (condAddr & 0xff);
            break;

          case 'IN': // AX00 - IN Rx
          case 'OUT': // BX00 - OUT Rx
            if (parts.length !== 2) {
              throw new Error(`${instruction} requires 1 operand: ${line}`);
            }
            const ioReg = this.parseRegister(parts[1]);
            machineInstruction = (baseOpcode << 12) | (ioReg << 8);
            break;

          case 'LOADM': // CXaa ou CXYf - LOADM Rx, [a] ou LOADM Rx, [Ry]
            if (parts.length !== 3) {
              throw new Error(`LOADM requires 2 operands: ${line}`);
            }

            const loadmReg = this.parseRegister(parts[1]);
            const loadSource = this.parseOperand(parts[2]);

            if (loadSource.type !== 'memory') {
              throw new Error(
                `LOADM second operand must be memory address: ${line}`,
              );
            }

            // Verifica se é registrador indireto ([Ry]) ou endereço direto ([a])
            if (loadSource.value & 0x10) {
              // Registrador indireto: CXYf onde f=F indica indireto
              const addrReg = loadSource.value & 0x0f;
              machineInstruction =
                (baseOpcode << 12) | (loadmReg << 8) | (addrReg << 4) | 0xf;
            } else {
              // Endereço direto: CXaa
              machineInstruction =
                (baseOpcode << 12) |
                (loadmReg << 8) |
                (loadSource.value & 0xff);
            }
            break;

          case 'STOREM': // DaaX ou DYfX - STOREM [a], Rx ou STOREM [Ry], Rx
            if (parts.length !== 3) {
              throw new Error(`STOREM requires 2 operands: ${line}`);
            }

            const storeTarget = this.parseOperand(parts[1]);
            const storeReg = this.parseRegister(parts[2]);

            if (storeTarget.type !== 'memory') {
              throw new Error(
                `STOREM first operand must be memory address: ${line}`,
              );
            }

            // Verifica se é registrador indireto ([Ry]) ou endereço direto ([a])
            if (storeTarget.value & 0x10) {
              // Registrador indireto: DYfX onde f=F indica indireto
              const addrReg = storeTarget.value & 0x0f;
              machineInstruction =
                (baseOpcode << 12) | (addrReg << 8) | (0xf << 4) | storeReg;
            } else {
              // Endereço direto: DaaX
              machineInstruction =
                (baseOpcode << 12) |
                ((storeTarget.value & 0xff) << 4) |
                storeReg;
            }
            break;

          case 'CALL': // Eaaa - CALL a
            if (parts.length !== 2) {
              throw new Error(`CALL requires 1 operand: ${line}`);
            }
            const callAddr =
              labels[parts[1]] !== undefined
                ? labels[parts[1]]
                : this.parseNumber(parts[1]);
            machineInstruction = (baseOpcode << 12) | (callAddr & 0xfff);
            break;

          case 'RET': // F000 - RET
            machineInstruction = 0xf000;
            break;

          case 'HLT': // FF00 - HLT
            machineInstruction = 0xff00;
            break;

          default:
            throw new Error(`Unhandled instruction: ${instruction}`);
        }

        machineCode.push(machineInstruction);
      } catch (error: any) {
        throw new Error(`Error in line "${line}": ${error.message}`);
      }
    }

    return machineCode;
  }

  static disassemble(machineCode: number[]): string {
    const result: string[] = [];

    for (let i = 0; i < machineCode.length; i++) {
      const instruction = machineCode[i];
      const opcode = (instruction >> 12) & 0xf;
      const fullOpcode = (instruction >> 8) & 0xff;
      const regX = (instruction >> 8) & 0xf;
      const regY = (instruction >> 4) & 0xf;
      const immediate = instruction & 0xff;
      const address = instruction & 0xfff;

      let line = `${i.toString().padStart(3, '0')}: 0x${instruction
        .toString(16)
        .padStart(4, '0')
        .toUpperCase()} `;

      switch (opcode) {
        case 0x0: // MOV
          line += `MOV R${regX}, R${regY}`;
          break;
        case 0x1: // LOAD
          line += `LOAD R${regX}, ${immediate}`;
          break;
        case 0x2: // ADD
          line += `ADD R${regX}, R${regY}`;
          break;
        case 0x3: // SUB
          line += `SUB R${regX}, R${regY}`;
          break;
        case 0x4: // MUL
          line += `MUL R${regX}, R${regY}`;
          break;
        case 0x5: // DIV
          line += `DIV R${regX}, R${regY}`;
          break;
        case 0x6: // JMP
          line += `JMP ${address}`;
          break;
        case 0x7: // JZ
          line += `JZ R${regX}, ${immediate}`;
          break;
        case 0x8: // JN
          line += `JN R${regX}, ${immediate}`;
          break;
        case 0x9: // JP
          line += `JP R${regX}, ${immediate}`;
          break;
        case 0xa: // IN
          line += `IN R${regX}`;
          break;
        case 0xb: // OUT
          line += `OUT R${regX}`;
          break;
        case 0xc: // LOADM
          const loadIsRegisterIndirect = (instruction & 0xf) === 0xf;

          if (loadIsRegisterIndirect) {
            // Formato registrador indireto CXYf
            const addrReg = (instruction >> 4) & 0xf;
            line += `LOADM R${regX}, [R${addrReg}]`;
          } else {
            // Formato endereço direto CXaa
            line += `LOADM R${regX}, [${immediate}]`;
          }
          break;
        case 0xd: // STOREM
          const storeIsRegisterIndirect = ((instruction >> 4) & 0xf) === 0xf;

          if (storeIsRegisterIndirect) {
            // Formato registrador indireto DYfX
            const addrReg = (instruction >> 8) & 0xf;
            const regField = instruction & 0xf;
            line += `STOREM [R${addrReg}], R${regField}`;
          } else {
            // Formato endereço direto DaaX
            const addrField = (instruction >> 4) & 0xff;
            const regField = instruction & 0xf;
            line += `STOREM [${addrField}], R${regField}`;
          }
          break;
        case 0xe: // CALL
          line += `CALL ${address}`;
          break;
        case 0xf: // RET ou HLT
          if (fullOpcode === 0xf0) {
            line += `RET`;
          } else if (fullOpcode === 0xff) {
            line += `HLT`;
          } else {
            line += `UNKNOWN F-type`;
          }
          break;
        default:
          line += `UNKNOWN`;
      }

      result.push(line);
    }

    return result.join('\n');
  }

  private static parseOperand(operand: string): {
    type: 'register' | 'immediate' | 'memory';
    value: number;
  } {
    // Remove espaços
    operand = operand.trim();

    // Verifica se é um endereço de memória [...]
    if (operand.startsWith('[') && operand.endsWith(']')) {
      const inner = operand.slice(1, -1).trim();

      // Verifica se o conteúdo dentro dos colchetes é um registrador
      const regMatch = inner.match(/^R([0-3])$/i);
      if (regMatch) {
        return { type: 'memory', value: parseInt(regMatch[1]) | 0x10 }; // Flag para indicar registrador
      } else {
        return { type: 'memory', value: this.parseNumber(inner) };
      }
    }

    // Verifica se é um registrador
    const regMatch = operand.match(/^R([0-3])$/i);
    if (regMatch) {
      return { type: 'register', value: parseInt(regMatch[1]) };
    }

    // É um valor imediato
    return { type: 'immediate', value: this.parseNumber(operand) };
  }
}
