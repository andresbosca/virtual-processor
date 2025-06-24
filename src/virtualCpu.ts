interface CPUState {
  registers: number[];
  pc: number;
  sp: number;
  flags: {
    zero: boolean;
    negative: boolean;
    overflow: boolean;
    carry: boolean;
  };
  memory: number[];
  running: boolean;
  inputBuffer: string[];
  outputBuffer: string[];
}

export class VirtualCPU {
  private static readonly MEMORY_SIZE = 65536; // 64KB
  private static readonly ROM_SIZE = 32768; // 32KB ROM
  private static readonly STACK_START = 0xfffe; // Stack starts at top of memory

  private registers: number[] = [0, 0, 0, 0]; // R0, R1, R2, R3
  private pc: number = 0; // Program Counter
  private sp: number = VirtualCPU.STACK_START; // Stack Pointer
  private flags = {
    zero: false,
    negative: false,
    overflow: false,
    carry: false,
  };
  private memory: number[] = new Array(VirtualCPU.MEMORY_SIZE).fill(0);
  private running: boolean = false;
  private inputBuffer: string[] = [];
  private outputBuffer: string[] = [];

  constructor() {
    this.reset();
  }

  // Reset CPU to initial state
  reset(): void {
    this.registers.fill(0);
    this.pc = 0;
    this.sp = VirtualCPU.STACK_START;
    this.flags = {
      zero: false,
      negative: false,
      overflow: false,
      carry: false,
    };
    this.memory.fill(0);
    this.running = false;
    this.inputBuffer = [];
    this.outputBuffer = [];
  }

  // Load program into ROM (first 32KB)
  loadProgram(program: number[]): void {
    if (program.length > VirtualCPU.ROM_SIZE) {
      throw new Error('Program too large for ROM');
    }
    for (let i = 0; i < program.length; i++) {
      this.memory[i] = program[i];
    }
  }

  // Set input for the CPU
  setInput(input: string): void {
    this.inputBuffer = input.split('');
  }

  // Get output from CPU
  getOutput(): string {
    return this.outputBuffer.join('');
  }

  // Clear output buffer
  clearOutput(): void {
    this.outputBuffer = [];
  }

  // Get current CPU state
  getState(): CPUState {
    return {
      registers: [...this.registers],
      pc: this.pc,
      sp: this.sp,
      flags: { ...this.flags },
      memory: [...this.memory],
      running: this.running,
      inputBuffer: [...this.inputBuffer],
      outputBuffer: [...this.outputBuffer],
    };
  }

  // Update flags based on result
  private updateFlags(result: number): void {
    this.flags.zero = result === 0;
    this.flags.negative = result < 0;
    this.flags.overflow = result > 0x7fffffff || result < -0x80000000;
  }

  // Fetch next instruction
  private fetch(): number {
    if (this.pc >= VirtualCPU.MEMORY_SIZE) {
      throw new Error('Program Counter out of bounds');
    }
    return this.memory[this.pc++];
  }

  // Execute single instruction
  executeStep(): boolean {
    if (!this.running) {
      this.running = true;
    }

    const instruction = this.fetch();
    const opcode = (instruction & 0xff00) >> 8;
    const operand = instruction & 0x00ff;

    switch (
      opcode & 0xf0 // Usar apenas os 4 bits superiores
    ) {
      case 0x00: // MOV Rx, Ry
        this.executeMov(opcode & 0x0f, (operand & 0xf0) >> 4, operand & 0x0f);
        break;
      case 0x10: // LOAD Rx, n
        this.executeLoad(opcode & 0x0f, operand);
        break;
      case 0x20: // ADD Rx, Ry
        this.executeAdd(opcode & 0x0f, (operand & 0xf0) >> 4, operand & 0x0f);
        break;
      case 0x30: // SUB Rx, Ry
        this.executeSub(opcode & 0x0f, (operand & 0xf0) >> 4, operand & 0x0f);
        break;
      case 0x40: // MUL Rx, Ry
        this.executeMul(opcode & 0x0f, (operand & 0xf0) >> 4, operand & 0x0f);
        break;
      case 0x50: // DIV Rx, Ry
        this.executeDiv(opcode & 0x0f, (operand & 0xf0) >> 4, operand & 0x0f);
        break;
      case 0x60: // JMP a
        this.executeJmp(operand);
        break;
      case 0x70: // JZ Rx, n
        this.executeJz(opcode & 0x0f, operand);
        break;
      case 0x80: // JN Rx, n
        this.executeJn(opcode & 0x0f, operand);
        break;
      case 0x90: // JP Rx, n
        this.executeJp(opcode & 0x0f, operand);
        break;
      default:
        // Instruções especiais
        if (opcode === 0x10) {
          // IN Rx (opcode 0x10)
          this.executeIn(operand & 0x0f);
        } else if (opcode === 0x11) {
          // OUT Rx (opcode 0x11)
          this.executeOut(operand & 0x0f);
        } else if (opcode === 0x12) {
          // LOADM Rx, [a]
          this.executeLoadM(operand & 0x0f, (operand & 0xf0) >> 4);
        } else if (opcode === 0x13) {
          // STOREM [a], Rx
          this.executeStoreM((operand & 0xf0) >> 4, operand & 0x0f);
        } else if (opcode === 0x14) {
          // CALL ab
          this.executeCall(operand);
        } else if (opcode === 0x15) {
          // RET
          this.executeRet();
        } else if (opcode === 0xff) {
          // HLT
          this.executeHlt();
          return false;
        } else {
          throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
        }
    }

    return this.running;
  }

  // Execute complete program
  run(): void {
    this.running = true;
    let steps = 0;
    const maxSteps = 100000; // Prevent infinite loops

    while (this.running && steps < maxSteps) {
      if (!this.executeStep()) {
        break;
      }
      steps++;
    }

    if (steps >= maxSteps) {
      throw new Error('Program execution timeout - possible infinite loop');
    }
  }

  // Instruction implementations
  private executeMov(regX: number, regY: number, unused: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    this.registers[regX] = this.registers[regY];
  }

  private executeLoad(regX: number, value: number): void {
    this.validateRegister(regX);
    this.registers[regX] = value;
    this.updateFlags(value);
  }

  private executeAdd(regX: number, regY: number, unused: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    const result = this.registers[regX] + this.registers[regY];
    this.registers[regX] = result;
    this.updateFlags(result);
  }

  private executeSub(regX: number, regY: number, unused: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    const result = this.registers[regX] - this.registers[regY];
    this.registers[regX] = result;
    this.updateFlags(result);
  }

  private executeMul(regX: number, regY: number, unused: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    const result = this.registers[regX] * this.registers[regY];
    this.registers[regX] = result;
    this.updateFlags(result);
  }

  private executeDiv(regX: number, regY: number, unused: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    if (this.registers[regY] === 0) {
      throw new Error('Division by zero');
    }
    const result = Math.trunc(this.registers[regX] / this.registers[regY]);
    this.registers[regX] = result;
    this.updateFlags(result);
  }

  private executeJmp(address: number): void {
    this.pc = address;
  }

  private executeJz(regX: number, address: number): void {
    this.validateRegister(regX);
    if (this.registers[regX] === 0) {
      this.pc = address;
    }
  }

  private executeJn(regX: number, address: number): void {
    this.validateRegister(regX);
    if (this.registers[regX] < 0) {
      this.pc = address;
    }
  }

  private executeJp(regX: number, address: number): void {
    this.validateRegister(regX);
    if (this.registers[regX] > 0) {
      this.pc = address;
    }
  }

  private executeIn(regX: number): void {
    this.validateRegister(regX);
    if (this.inputBuffer.length > 0) {
      const char = this.inputBuffer.shift()!;
      this.registers[regX] = char.charCodeAt(0);
    } else {
      this.registers[regX] = 0; // No input available
    }
  }

  private executeOut(regX: number): void {
    this.validateRegister(regX);
    const charCode = this.registers[regX];
    this.outputBuffer.push(String.fromCharCode(charCode));
  }

  private executeLoadM(regX: number, address: number): void {
    this.validateRegister(regX);
    this.validateMemoryAddress(address);
    this.registers[regX] = this.memory[address];
  }

  private executeStoreM(address: number, regX: number): void {
    this.validateRegister(regX);
    this.validateMemoryAddress(address);
    if (address < VirtualCPU.ROM_SIZE) {
      throw new Error('Cannot write to ROM');
    }
    this.memory[address] = this.registers[regX];
  }

  private executeCall(address: number): void {
    if (this.sp <= VirtualCPU.ROM_SIZE) {
      throw new Error('Stack overflow');
    }
    this.memory[this.sp--] = this.pc;
    this.pc = address;
  }

  private executeRet(): void {
    if (this.sp >= VirtualCPU.STACK_START) {
      throw new Error('Stack underflow');
    }
    this.pc = this.memory[++this.sp];
  }

  private executeHlt(): void {
    this.running = false;
  }

  // Validation methods
  private validateRegister(reg: number): void {
    if (reg < 0 || reg > 3) {
      throw new Error(`Invalid register: R${reg}`);
    }
  }

  private validateMemoryAddress(address: number): void {
    if (address < 0 || address >= VirtualCPU.MEMORY_SIZE) {
      throw new Error(`Invalid memory address: 0x${address.toString(16)}`);
    }
  }

  // Utility methods for debugging
  getRegisters(): number[] {
    return [...this.registers];
  }

  getPC(): number {
    return this.pc;
  }

  getSP(): number {
    return this.sp;
  }

  getFlags(): typeof this.flags {
    return { ...this.flags };
  }

  getMemory(start: number = 0, length: number = 32): number[] {
    return this.memory.slice(start, start + length);
  }

  isRunning(): boolean {
    return this.running;
  }
}
