export class CPU {
  registradores = [0, 0, 0, 0];
  pc = 0;
  sp = 255;
  flags = { Z: false, N: false };
  memoria = new Array<number>(256).fill(0);
  rom: number[] = [];
  pilha: number[] = new Array(256).fill(0);
  saida: string[] = [];
  entrada: string[] = [];

  carregarPrograma(texto: string) {
    const linhas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    this.rom = linhas.map((l) => parseInt(l, 16));
    this.pc = 0;
    this.sp = 255;
    this.saida = [];
    this.registradores.fill(0);
    this.memoria.fill(0);
    this.pilha.fill(0);
  }

  executar() {
    while (this.pc < this.rom.length) {
      if (this.executarProximo()) break;
    }
  }

  executarProximo(): boolean {
    if (this.pc >= this.rom.length) return true;

    const opcode = this.rom[this.pc++];

    if (opcode === 0xff) {
      return true; // HLT
    }

    if (opcode === 0x15) {
      // RET
      this.pc = this.pilha[this.sp++];
      return false;
    }

    const highNibble = (opcode & 0xf0) >> 4;
    const lowNibble = opcode & 0x0f;
    const X = (opcode & 0x0c) >> 2;
    const Y = opcode & 0x03;

    console.log(highNibble);

    switch (highNibble) {
      case 0x0: // MOV Rx, Ry (00XY)
        this.registradores[X] = this.registradores[Y];
        break;

      case 0x1: // LOAD Rx, n (01Xn)
        const n1 = this.rom[this.pc++];
        this.registradores[X] = n1;
        break;

      case 0x2: // ADD Rx, Ry (02XY)
        this.registradores[X] += this.registradores[Y];
        break;

      case 0x3: // SUB Rx, Ry (03XY)
        this.registradores[X] -= this.registradores[Y];
        break;

      case 0x4: // MUL Rx, Ry (04XY)
        this.registradores[X] *= this.registradores[Y];
        break;

      case 0x5: // DIV Rx, Ry (05XY)
        const divisor = this.registradores[Y];
        this.registradores[X] =
          divisor !== 0 ? Math.trunc(this.registradores[X] / divisor) : 0;
        break;

      case 0x6: // JMP a (06Xa)
        const addrJMP = this.rom[this.pc++];
        this.pc = addrJMP;
        break;

      case 0x7: // JZ Rx, n (07Xn)
        const addrJZ = this.rom[this.pc++];
        if (this.registradores[X] === 0) this.pc = addrJZ;
        break;

      case 0x8: // JN Rx, n (08Xn)
        const addrJN = this.rom[this.pc++];
        if (this.registradores[X] < 0) this.pc = addrJN;
        break;

      case 0x9: // JP Rx, n (09Xn)
        const addrJP = this.rom[this.pc++];
        if (this.registradores[X] > 0) this.pc = addrJP;
        break;

      case 0xa: // IN Rx (10Xx)
        const inputChar = this.entrada.shift() ?? '\0';
        this.registradores[X] = inputChar.charCodeAt(0);
        break;

      case 0xb: // OUT Rx (11Xx)
        this.saida.push(String.fromCharCode(this.registradores[X]));
        break;

      case 0xc: // LOADM Rx, [a] (12Xa)
        const addrLoad = this.rom[this.pc++];
        this.registradores[X] = this.memoria[addrLoad];
        break;

      case 0xd: // STOREM [a], Rx (13aX)
        const addrStore = this.rom[this.pc++];
        this.memoria[addrStore] = this.registradores[X];
        break;

      case 0xe: // CALL ab (14ab)
        const addrCall = this.rom[this.pc++];
        this.pilha[--this.sp] = this.pc;
        this.pc = addrCall;
        break;

      default:
        console.warn(
          `Opcode desconhecido: ${opcode.toString(16).padStart(2, '0').toUpperCase()}`,
        );
        break;
    }

    return false;
  }

  dumpRegistradores(): string {
    return [
      ...this.registradores.map((v, i) => `R${i}: ${v}`),
      `PC: ${this.pc}`,
      `SP: ${this.sp}`,
      `Flags: ${JSON.stringify(this.flags)}`,
    ].join('\n');
  }

  dumpMemoria(): string {
    return (
      this.memoria
        .map((v, i) => `${i}: ${v}`)
        .filter((_, i) => this.memoria[i] !== 0)
        .join('\n') || 'Memória vazia'
    );
  }

  getSaida(): string {
    return this.saida.join('');
  }

  setEntrada(str: string) {
    this.entrada = [...str];
  }
}
