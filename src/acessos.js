/* ============================================================
   Acessos · incluir, trocar senha e remover logins do Marketing.
   Tudo é gravado pela API do Cloudflare (tabela usuarios, senha com hash).
   Só administradores veem esta página funcionando.
   ============================================================ */
(function () {
  'use strict';
  var A = window.UnimedAcesso;
  var ctx = null;
  var editando = null;
  var $ = function (id) { return document.getElementById(id); };

  function chamar(caminho, opcoes) {
    opcoes = opcoes || {};
    opcoes.headers = Object.assign({ Authorization: 'Bearer ' + ctx.token }, opcoes.headers || {});
    return fetch(A.api() + caminho, opcoes).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.erro || ('Erro ' + r.status));
        return d;
      });
    });
  }

  function data(iso) { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (e) { return ''; } }

  function carregar() {
    var corpo = $('lista-acessos');
    return chamar('/usuarios').then(function (lista) {
      corpo.textContent = '';
      if (!lista.length) { corpo.appendChild(A.el('tr', null, [A.el('td', { colspan: '4', texto: 'Ninguém ainda. Crie o primeiro acesso ao lado.' })])); return; }
      lista.forEach(function (u) {
        var nome = A.el('td', null, [u.nome || u.usuario]);
        if (u.admin) nome.appendChild(A.el('span', { 'class': 'selo-admin', texto: 'ADMIN' }));
        var editar = A.el('button', { type: 'button', texto: 'Editar', onclick: function () { editar_(u); } });
        var remover = A.el('button', { type: 'button', texto: 'Remover', onclick: function () { remover_(u, remover); } });
        if (u.usuario === ctx.usuario) remover.disabled = true;
        corpo.appendChild(A.el('tr', null, [nome, A.el('td', { 'class': 'cod', texto: u.usuario }), A.el('td', { texto: data(u.criado_em) }), A.el('td', null, [A.el('div', { style: 'display:flex;gap:6px;justify-content:flex-end' }, [editar, remover])])]));
      });
    }).catch(function (e) { corpo.textContent = ''; corpo.appendChild(A.el('tr', null, [A.el('td', { colspan: '4', texto: 'Não consegui carregar: ' + e.message })])); });
  }

  function limpar() {
    editando = null;
    $('form-acesso').reset();
    $('a-usuario').disabled = false;
    $('form-titulo').textContent = 'Novo acesso';
    $('a-salvar').textContent = 'Criar acesso';
    $('a-cancelar').hidden = true;
    $('a-senha').placeholder = 'Pelo menos 8 caracteres';
    $('a-senha-ajuda').textContent = 'Passe a senha para a pessoa por um canal seguro.';
  }

  function editar_(u) {
    editando = u.usuario;
    $('a-nome').value = u.nome || '';
    $('a-usuario').value = u.usuario; $('a-usuario').disabled = true;
    $('a-senha').value = ''; $('a-senha').placeholder = 'Deixe em branco para manter';
    $('a-senha-ajuda').textContent = 'Preencha só se quiser trocar a senha.';
    $('a-admin').checked = !!u.admin;
    $('form-titulo').textContent = 'Editar ' + (u.nome || u.usuario);
    $('a-salvar').textContent = 'Salvar alterações';
    $('a-cancelar').hidden = false;
    $('a-status').textContent = '';
    $('a-nome').focus();
  }

  function remover_(u, botao) {
    if (botao.dataset.confirma !== '1') { botao.dataset.confirma = '1'; botao.textContent = 'Confirmar?'; setTimeout(function () { botao.dataset.confirma = ''; botao.textContent = 'Remover'; }, 4000); return; }
    botao.disabled = true;
    chamar('/usuarios/' + encodeURIComponent(u.usuario), { method: 'DELETE' })
      .then(function () { $('a-status').textContent = 'Acesso de ' + (u.nome || u.usuario) + ' removido.'; if (editando === u.usuario) limpar(); return carregar(); })
      .catch(function (e) { $('a-status').textContent = e.message; botao.disabled = false; });
  }

  function salvar(e) {
    e.preventDefault();
    var st = $('a-status');
    var dados = { nome: $('a-nome').value.trim(), usuario: $('a-usuario').value.trim().toLowerCase(), senha: $('a-senha').value, admin: $('a-admin').checked };
    if (!dados.nome) { st.textContent = 'Preencha o nome.'; $('a-nome').focus(); return; }
    if (!dados.usuario) { st.textContent = 'Preencha o usuário.'; $('a-usuario').focus(); return; }
    if (!editando && dados.senha.length < 8) { st.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; $('a-senha').focus(); return; }
    var botao = $('a-salvar'); botao.disabled = true; st.textContent = 'Salvando…';
    chamar('/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
      .then(function () { st.textContent = editando ? 'Alterações salvas.' : 'Acesso criado. Usuário: ' + dados.usuario; limpar(); return carregar(); })
      .catch(function (x) { st.textContent = x.message; })
      .then(function () { botao.disabled = false; });
  }

  A.proteger({
    pagina: 'acessos.html',
    aoLiberar: function (c) {
      ctx = c;
      if (!c.admin || c.local && !A.api()) { $('sem-permissao').hidden = false; $('acessos-area').hidden = true; return; }
      $('form-acesso').addEventListener('submit', salvar);
      $('a-cancelar').addEventListener('click', limpar);
      carregar();
    }
  });
})();
