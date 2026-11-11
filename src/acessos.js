/* Acessos: o "dono" inclui, muda o papel ou remove quem pode entrar na área restrita. */
(function () {
  'use strict';
  var A = window.UnimedAcesso, el = A.el;
  var $ = function (id) { return document.getElementById(id); };
  var eu = '';

  function msg(texto, tipo) {
    var c = $('a-msg'); c.textContent = '';
    if (texto) c.appendChild(el('p', { 'class': 'alerta ' + (tipo || 'erro'), texto: texto }));
  }

  async function carregar() {
    var corpo = $('a-linhas'); corpo.textContent = '';
    var lista = await A.banco('acessos?select=*&order=criado_em.asc');
    lista.forEach(function (p) {
      var sou = p.github === eu;
      var papel = el('select', { 'aria-label': 'Papel de @' + p.github });
      [['equipe', 'Equipe'], ['dono', 'Dono']].forEach(function (o) { var op = el('option', { value: o[0], texto: o[1] }); if (o[0] === p.papel) op.selected = true; papel.appendChild(op); });
      if (sou) papel.disabled = true;
      papel.addEventListener('change', async function () {
        try { await A.banco('acessos?github=eq.' + encodeURIComponent(p.github), { metodo: 'PATCH', corpo: { papel: papel.value }, cabecalhos: { Prefer: 'return=minimal' } }); msg('Papel atualizado.', 'ok'); }
        catch (e) { msg(e.message); papel.value = p.papel; }
      });
      corpo.appendChild(el('tr', {}, [
        el('td', { texto: (p.nome || '—') + (sou ? ' (você)' : '') }),
        el('td', {}, [el('a', { href: 'https://github.com/' + encodeURIComponent(p.github), target: '_blank', rel: 'noopener', texto: '@' + p.github })]),
        el('td', {}, [papel]),
        el('td', { texto: new Date(p.criado_em).toLocaleDateString('pt-BR') }),
        el('td', {}, [sou ? null : el('button', { type: 'button', texto: 'Remover', onclick: async function () {
          if (!window.confirm('Remover o acesso de @' + p.github + '?')) return;
          try { await A.banco('acessos?github=eq.' + encodeURIComponent(p.github), { metodo: 'DELETE', cabecalhos: { Prefer: 'return=minimal' } }); msg('Acesso removido.', 'ok'); carregar(); }
          catch (e) { msg(e.message); }
        } })])
      ]));
    });
  }

  async function iniciar(ctx) {
    if (ctx.local) {
      var aviso = $('origem'); aviso.hidden = false;
      aviso.textContent = 'Modo de teste no seu computador: a lista de acessos só funciona depois de ligar o banco com login (docs/acesso-restrito.md).';
      $('novo-acesso').querySelector('button').disabled = true;
      return;
    }
    eu = String(ctx.github || '').toLowerCase();
    $('novo-acesso').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var github = $('a-github').value.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '').toLowerCase();
      if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/.test(github)) return msg('Digite um usuário do GitHub válido (só letras, números e hífen).');
      try {
        await A.banco('acessos', { metodo: 'POST', corpo: { github: github, nome: $('a-nome').value.trim() || null, papel: $('a-papel').value }, cabecalhos: { Prefer: 'return=minimal' } });
        msg('Acesso liberado para @' + github + '. Avise a pessoa para entrar em "Área restrita → Entrar com GitHub".', 'ok');
        $('a-github').value = ''; $('a-nome').value = '';
        carregar();
      } catch (e) { msg(e.message); }
    });
    try { await carregar(); } catch (e) { msg(e.message); }
  }

  A.proteger({ pagina: 'acessos.html', papelMinimo: 'dono', aoLiberar: iniciar });
})();
