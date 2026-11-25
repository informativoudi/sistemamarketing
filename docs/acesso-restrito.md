# Área restrita

A área restrita reúne o Painel, o Núcleo da Marca, o Radar de Tendências e a página **Acessos**. Cada pessoa do Marketing entra com **usuário e senha** próprios.

- **Incluir, editar ou remover alguém:** página **Acessos** (aparece no menu só para administradores). Os logins ficam no banco D1 do Cloudflare, com a senha protegida por hash. Nada disso vai para o GitHub.
- **Sem usuário não entra:** a senha geral sozinha foi desligada.
- **Chave reserva:** o segredo `USUARIOS` do Worker `unimed-pecas` (JSON `{"usuario":"senha"}`) guarda logins de administrador. Se alguém perder o acesso, edite esse segredo no Cloudflare. O segredo `SENHA` não é mais usado e pode ser apagado.
- **Depois de entrar:** a senha fica guardada só naquele navegador. **Sair** apaga.
- **Em testes:** no computador local (`localhost`), a área abre sem senha.

O gerador continua aberto para qualquer área criar peças. As regras da marca, dos formatos e das tendências ficam em `config/`. Para mudar uma regra, peça ao Claude: ele altera os arquivos e publica no GitHub.
