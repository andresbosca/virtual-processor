import { CPU } from './cpu.js';

const executarBtn = document.getElementById('executar')!;
const passoBtn = document.getElementById('passo')!;
const entradaInput = document.getElementById('entrada') as HTMLInputElement;
const programaInput = document.getElementById(
  'programa',
) as HTMLTextAreaElement;
const regsOut = document.getElementById('registradores')!;
const memOut = document.getElementById('memoria')!;
const saidaOut = document.getElementById('saida')!;

const cpu = new CPU();

function atualizarInterface() {
  regsOut.textContent = cpu.dumpRegistradores();
  memOut.textContent = cpu.dumpMemoria();
  saidaOut.textContent = cpu.getSaida();
}

function prepararExecucao() {
  const entrada = entradaInput.value;
  cpu.setEntrada(entrada + '\0'); // adiciona '\0' como terminador, útil em programas que verificam fim
  cpu.carregarPrograma(programaInput.value);
}

executarBtn.addEventListener('click', () => {
  prepararExecucao();
  cpu.executar();
  atualizarInterface();
});

passoBtn.addEventListener('click', () => {
  if (cpu.pc === 0) prepararExecucao();
  cpu.executarProximo();
  atualizarInterface();
});
