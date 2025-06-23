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
      .map((l) => l.trim().split(';')[0].trim()) // remove comentários
      .filter((l) => l);
    console.log(linhas);
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
    const opcode = this.rom[this.pc++];
    const op = (opcode & 0xf0) >> 4;
    const x = (opcode & 0x0c) >> 2;
    const y = opcode & 0x03;

    console.log({ opcode, op1: 0xff, op2: 0x15, op });
    switch (opcode) {
      case 0xff:
        return true; // HLT
      case 0x15:
        this.pc = this.pilha[this.sp++];
        break;
      default:
        console.log(opcode);
        const instr = opcode.toString(16).padStart(2, '0').toUpperCase();
        if (instr.startsWith('00')) {
          // MOV Rx, Ry
          this.registradores[x] = this.registradores[y];
        } else if (instr.startsWith('01')) {
          const n = this.rom[this.pc++];
          this.registradores[x] = n;
        } else if (instr.startsWith('02')) {
          this.registradores[x] += this.registradores[y];
        } else if (instr.startsWith('03')) {
          this.registradores[x] -= this.registradores[y];
        } else if (instr.startsWith('04')) {
          this.registradores[x] *= this.registradores[y];
        } else if (instr.startsWith('05')) {
          this.registradores[x] = Math.trunc(
            this.registradores[x] / this.registradores[y],
          );
        } else if (instr.startsWith('06')) {
          const addr = this.rom[this.pc++];
          this.pc = addr;
        } else if (instr.startsWith('07')) {
          const addr = this.rom[this.pc++];
          if (this.registradores[x] === 0) this.pc = addr;
        } else if (instr.startsWith('08')) {
          const addr = this.rom[this.pc++];
          if (this.registradores[x] < 0) this.pc = addr;
        } else if (instr.startsWith('09')) {
          const addr = this.rom[this.pc++];
          if (this.registradores[x] > 0) this.pc = addr;
        } else if (instr.startsWith('10')) {
          const char = this.entrada.shift() ?? '\0';
          this.registradores[x] = char.charCodeAt(0);
        } else if (instr.startsWith('11')) {
          this.saida.push(String.fromCharCode(this.registradores[x]));
        } else if (instr.startsWith('12')) {
          const addr = this.rom[this.pc++];
          this.registradores[x] = this.memoria[addr];
        } else if (instr.startsWith('13')) {
          const addr = this.rom[this.pc++];
          this.memoria[addr] = this.registradores[x];
        } else if (instr.startsWith('14')) {
          const addr = this.rom[this.pc++];
          this.pilha[--this.sp] = this.pc;
          this.pc = addr;
        } else {
          console.warn(`Opcode desconhecido: ${instr}`);
        }
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
