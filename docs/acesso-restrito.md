# Área restrita

A área restrita reúne o Painel, o Núcleo da Marca e o Radar de Tendências, e pede a **senha do Marketing**.

- **Onde fica a senha:** no segredo `SENHA` do Worker `unimed-pecas`, no Cloudflare (veja `docs/registro-cloudflare.md`).
- **Depois de entrar:** a senha fica guardada só naquele navegador. **Sair** apaga.
- **Em testes:** no computador local (`localhost`), a área abre sem senha.

O gerador continua aberto para qualquer área criar peças. As regras da marca, dos formatos e das tendências ficam em `config/`. Para mudar uma regra, peça ao Claude: ele altera os arquivos e publica no GitHub.
