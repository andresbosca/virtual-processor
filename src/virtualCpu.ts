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

  loadProgram(program: number[]): void {
    if (program.length > VirtualCPU.ROM_SIZE) {
      throw new Error('Program too large for ROM');
    }
    for (let i = 0; i < program.length; i++) {
      this.memory[i] = program[i];
    }
  }

  setInput(input: string): void {
    this.inputBuffer = input.split(' ');
  }

  getOutput(): string {
    return this.outputBuffer.join('');
  }

  clearOutput(): void {
    this.outputBuffer = [];
  }

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

  private updateFlags(result: number): void {
    this.flags.zero = result === 0;
    this.flags.negative = result < 0;
    this.flags.overflow = result > 0x7fffffff || result < -0x80000000;
  }

  private fetch(): number {
    if (this.pc >= VirtualCPU.MEMORY_SIZE) {
      throw new Error('Program Counter out of bounds');
    }
    return this.memory[this.pc++];
  }

  executeStep(): boolean {
    if (!this.running) {
      this.running = true;
    }

    const instruction = this.fetch();
    const opcode = (instruction >> 12) & 0xf;
    const fullOpcode = (instruction >> 8) & 0xff;
    const regX = (instruction >> 8) & 0xf;
    const regY = (instruction >> 4) & 0xf;
    const immediate = instruction & 0xff;
    const address = instruction & 0xfff;

    switch (opcode) {
      case 0x0: // MOV Rx, Ry
        this.executeMov(regX, regY);
        break;
      case 0x1: // LOAD Rx, n
        this.executeLoad(regX, immediate);
        break;
      case 0x2: // ADD Rx, Ry
        this.executeAdd(regX, regY);
        break;
      case 0x3: // SUB Rx, Ry
        this.executeSub(regX, regY);
        break;
      case 0x4: // MUL Rx, Ry
        this.executeMul(regX, regY);
        break;
      case 0x5: // DIV Rx, Ry
        this.executeDiv(regX, regY);
        break;
      case 0x6: // JMP a
        this.executeJmp(address);
        break;
      case 0x7: // JZ Rx, n
        this.executeJz(regX, immediate);
        break;
      case 0x8: // JN Rx, n
        this.executeJn(regX, immediate);
        break;
      case 0x9: // JP Rx, n
        this.executeJp(regX, immediate);
        break;
      case 0xa: // IN Rx
        this.executeIn(regX);
        break;
      case 0xb: // OUT Rx
        this.executeOut(regX);
        break;
      case 0xc: // LOADM Rx, [a]
        this.executeLoadM(regX, immediate + VirtualCPU.ROM_SIZE);
        break;
      case 0xd: // STOREM [a], Rx
        this.executeStoreM(regY + VirtualCPU.ROM_SIZE, instruction & 0xf);
        break;
      case 0xe: // CALL ab
        this.executeCall(address);
        break;
      case 0xf: // RET ou HLT
        if (fullOpcode === 0xf0) {
          this.executeRet();
        } else if (fullOpcode === 0xff) {
          this.executeHlt();
          return false;
        } else {
          throw new Error(
            `Unknown F-type instruction: 0x${fullOpcode.toString(16)}`,
          );
        }
        break;
      default:
        throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
    }

    return this.running;
  }

  run(): void {
    this.running = true;
    let steps = 0;
    const maxSteps = 100000;

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
  private executeMov(regX: number, regY: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    this.registers[regX] = this.registers[regY];
    this.updateFlags(this.registers[regX]);
  }

  private executeLoad(regX: number, value: number): void {
    this.validateRegister(regX);
    this.registers[regX] = value;
    this.updateFlags(value);
  }

  private executeAdd(regX: number, regY: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    const result = this.registers[regX] + this.registers[regY];
    this.flags.carry = result > 0xffff;
    this.registers[regX] = result & 0xffff;
    this.updateFlags(this.registers[regX]);
  }

  private executeSub(regX: number, regY: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    const result = this.registers[regX] - this.registers[regY];
    this.registers[regX] = result < 0 ? 0 : result;
    this.updateFlags(this.registers[regX]);
  }

  private executeMul(regX: number, regY: number): void {
    this.validateRegister(regX);
    this.validateRegister(regY);
    const result = this.registers[regX] * this.registers[regY];
    this.flags.overflow = result > 0xffff;
    this.registers[regX] = result & 0xffff;
    this.updateFlags(this.registers[regX]);
  }

  private executeDiv(regX: number, regY: number): void {
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
    if (this.registers[regX] < 0 || this.flags.negative) {
      this.pc = address;
    }
  }

  private executeJp(regX: number, address: number): void {
    this.validateRegister(regX);
    if (this.registers[regX] > 0 && !this.flags.negative) {
      this.pc = address;
    }
  }

  private executeIn(regX: number): void {
    this.validateRegister(regX);
    if (this.inputBuffer.length > 0) {
      const char = this.inputBuffer.shift()!;
      this.registers[regX] = char.charCodeAt(0);
    } else {
      this.registers[regX] = 0;
    }
    this.updateFlags(this.registers[regX]);
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
    this.updateFlags(this.registers[regX]);
  }

  private executeStoreM(address: number, regX: number): void {
    this.validateRegister(regX);
    this.validateMemoryAddress(address);
    if (address < VirtualCPU.ROM_SIZE) {
      console.log(
        `Warning: Writing to ROM at address 0x${address.toString(16)}`,
      );
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

  private validateRegister(reg: number): void {
    if (reg < 0 || reg > 3) {
      throw new Error(`Invalid register: R${reg}`);
    }
  }

  private validateMemoryAddress(address: number): void {
    if (address < VirtualCPU.ROM_SIZE || address >= VirtualCPU.MEMORY_SIZE) {
      throw new Error(`Invalid memory address: 0x${address.toString(16)}`);
    }
  }

  // Utility methods
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
