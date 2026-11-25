# Área restrita

A área restrita reúne o Painel, o Núcleo da Marca e o Radar de Tendências. Cada pessoa do Marketing entra com **usuário e senha** próprios.

- **Onde ficam os logins:** no segredo `USUARIOS` do Worker `unimed-pecas`, no Cloudflare, em formato JSON:
  `{"joander":"senha-do-joander","maria":"senha-da-maria"}`
- **Incluir ou tirar alguém:** edite o segredo `USUARIOS` (Configurações → Variáveis e segredos) e salve. Não precisa mexer no site.
- **Senha geral (opcional):** o segredo `SENHA` continua valendo para entrar deixando o usuário em branco. Para desligar, apague esse segredo.
- **Depois de entrar:** a senha fica guardada só naquele navegador. **Sair** apaga.
- **Em testes:** no computador local (`localhost`), a área abre sem senha.

O gerador continua aberto para qualquer área criar peças. As regras da marca, dos formatos e das tendências ficam em `config/`. Para mudar uma regra, peça ao Claude: ele altera os arquivos e publica no GitHub.
