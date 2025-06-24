import { Assembler } from './assembler.js';
import { VirtualCPU } from './virtualCpu.js';

export class CPUSimulator {
  private cpu: VirtualCPU;
  private programElement: HTMLTextAreaElement;
  private entradaElement: HTMLInputElement;
  private registradoresElement: HTMLPreElement;
  private memoriaElement: HTMLPreElement;
  private saidaElement: HTMLPreElement;
  private executarButton: HTMLButtonElement;
  private passoButton: HTMLButtonElement;

  constructor() {
    this.cpu = new VirtualCPU();

    this.programElement = document.getElementById(
      'programa',
    ) as HTMLTextAreaElement;
    this.entradaElement = document.getElementById(
      'entrada',
    ) as HTMLInputElement;
    this.registradoresElement = document.getElementById(
      'registradores',
    ) as HTMLPreElement;
    this.memoriaElement = document.getElementById('memoria') as HTMLPreElement;
    this.saidaElement = document.getElementById('saida') as HTMLPreElement;
    this.executarButton = document.getElementById(
      'executar',
    ) as HTMLButtonElement;
    this.passoButton = document.getElementById('passo') as HTMLButtonElement;

    this.setupEventListeners();
    this.updateDisplay();
    this.loadExampleProgram();
  }

  private setupEventListeners(): void {
    this.executarButton.addEventListener('click', () => this.executar());
    this.passoButton.addEventListener('click', () => this.executarPasso());

    // Update input when user types
    this.entradaElement.addEventListener('input', () => {
      this.cpu.setInput(this.entradaElement.value);
    });

    // Reset and load program when program changes
    this.programElement.addEventListener('input', () => {
      this.resetCPU();
    });

    const scrollToPCButton = document.getElementById('scroll-to-pc');
    const scrollToTopButton = document.getElementById('scroll-to-top');

    if (scrollToPCButton) {
      scrollToPCButton.addEventListener('click', () => {
        this.scrollToCurrentInstruction();
      });
    }

    if (scrollToTopButton) {
      scrollToTopButton.addEventListener('click', () => {
        this.memoriaElement.scrollTop = 0;
      });
    }
  }

  private loadExampleProgram(): void {
    const exampleProgram = `LOAD R0, 73
OUT R0
HLT`;

    this.programElement.value = exampleProgram;
  }

  private resetCPU(): void {
    this.cpu.reset();
    this.cpu.setInput(this.entradaElement.value);
    this.updateDisplay();
  }

  private executar(): void {
    try {
      this.resetCPU();
      const program = this.programElement.value;
      const machineCode = Assembler.assemble(program);
      console.log(
        `Código de máquina gerado: ${machineCode.map((x) => x.toString(16).toUpperCase().padStart(4, '0')).join(' ')}`,
      );
      this.cpu.loadProgram(machineCode);
      this.cpu.run();
      this.updateDisplay();
    } catch (error: any) {
      alert(`Erro na execução: ${error.message}`);
    }
  }

  private executarPasso(): void {
    try {
      if (!this.cpu.isRunning()) {
        // First step - load program
        const program = this.programElement.value;
        const machineCode = Assembler.assemble(program);
        this.cpu.loadProgram(machineCode);
      }

      const continueExecution = this.cpu.executeStep();
      this.updateDisplay();

      if (!continueExecution) {
        alert('Programa finalizado');
      }
    } catch (error: any) {
      alert(`Erro na execução: ${error.message}`);
    }
  }

  private updateDisplay(): void {
    this.updateRegistradores();
    this.updateMemoria();
    this.updateSaida();
  }

  private updateRegistradores(): void {
    const state = this.cpu.getState();
    let display = 'REGISTRADORES:\n';
    display += `R0: ${state.registers[0].toString().padStart(6, ' ')}\n`;
    display += `R1: ${state.registers[1].toString().padStart(6, ' ')}\n`;
    display += `R2: ${state.registers[2].toString().padStart(6, ' ')}\n`;
    display += `R3: ${state.registers[3].toString().padStart(6, ' ')}\n`;
    display += '\nREGISTRADORES ESPECIAIS:\n';
    display += `PC: ${state.pc.toString().padStart(6, ' ')}\n`;
    display += `SP: 0x${state.sp.toString(16).toUpperCase().padStart(4, '0')}\n`;
    display += '\nFLAGS:\n';
    display += `Zero:     ${state.flags.zero ? '1' : '0'}\n`;
    display += `Negative: ${state.flags.negative ? '1' : '0'}\n`;
    display += `Overflow: ${state.flags.overflow ? '1' : '0'}\n`;
    display += `Carry:    ${state.flags.carry ? '1' : '0'}\n`;
    display += '\nSTATUS:\n';
    display += `Running: ${state.running ? 'SIM' : 'NÃO'}`;

    this.registradoresElement.textContent = display;
  }

  private updateMemoria(): void {
    const currentPC = this.cpu.getPC();
    const memory = this.cpu.getMemory(0, 256); // Mostra mais memória (256 bytes)

    let display = 'MEMÓRIA (ROM - Instruções carregadas):\n';
    display += 'Addr | Hex  | Dec | Instruction\n';
    display += '-----|------|-----|-------------\n';

    let lastNonZeroIndex = 0;

    // Encontra o último endereço com conteúdo significativo
    for (let i = memory.length - 1; i >= 0; i--) {
      if (memory[i] !== 0) {
        lastNonZeroIndex = i;
        break;
      }
    }

    // Mostra pelo menos até o PC atual ou até onde há conteúdo
    const maxIndex = Math.max(lastNonZeroIndex + 5, currentPC + 10, 32);

    for (let i = 0; i <= maxIndex && i < memory.length; i++) {
      const value = memory[i];
      const addr = i.toString().padStart(4, '0');
      const hex = value.toString(16).toUpperCase().padStart(4, '0');
      const dec = value.toString().padStart(5, ' ');

      // Try to disassemble if not zero
      let instruction = '';
      if (value !== 0) {
        try {
          const disassembled = Assembler.disassemble([value]);
          instruction = disassembled.split(' ').slice(2).join(' ');
        } catch {
          instruction = 'INVALID';
        }
      }

      // Marca a instrução atual
      const marker = currentPC === i ? '>' : ' ';
      const lineClass = currentPC === i ? 'current-line' : '';

      if (lineClass) {
        display += `<span class="${lineClass}">${marker}${addr} | ${hex} | ${dec} | ${instruction}</span>\n`;
      } else {
        display += `${marker}${addr} | ${hex} | ${dec} | ${instruction}\n`;
      }
    }

    this.memoriaElement.innerHTML = display;

    // Auto-scroll para a instrução atual
    this.scrollToCurrentInstruction();
  }

  private scrollToCurrentInstruction(): void {
    const currentPC = this.cpu.getPC();
    const memoriaElement = this.memoriaElement;

    // Encontra a linha atual
    const currentLine = memoriaElement.querySelector('.current-line');
    if (currentLine) {
      // Calcula a posição da linha atual
      const lineHeight = 16; // Altura aproximada de cada linha
      const headerLines = 3; // Linhas de cabeçalho
      const targetLine = currentPC + headerLines;
      const scrollPosition = targetLine * lineHeight;

      // Scroll suave para a posição
      memoriaElement.scrollTo({
        top: scrollPosition - memoriaElement.clientHeight / 2,
        behavior: 'smooth',
      });
    }
  }

  private updateSaida(): void {
    const output = this.cpu.getOutput();
    const state = this.cpu.getState();

    let display = 'SAÍDA:\n';
    display += output || '(vazio)';
    display += '\n\nENTRADA RESTANTE:\n';
    display += state.inputBuffer.join('') || '(vazio)';

    this.saidaElement.textContent = display;
  }
}
