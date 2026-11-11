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
      var sou = p.email === eu;
      var papel = el('select', { 'aria-label': 'Papel de ' + p.email });
      [['equipe', 'Equipe'], ['dono', 'Dono']].forEach(function (o) { var op = el('option', { value: o[0], texto: o[1] }); if (o[0] === p.papel) op.selected = true; papel.appendChild(op); });
      if (sou) papel.disabled = true;
      papel.addEventListener('change', async function () {
        try { await A.banco('acessos?email=eq.' + encodeURIComponent(p.email), { metodo: 'PATCH', corpo: { papel: papel.value }, cabecalhos: { Prefer: 'return=minimal' } }); msg('Papel atualizado.', 'ok'); }
        catch (e) { msg(e.message); papel.value = p.papel; }
      });
      corpo.appendChild(el('tr', {}, [
        el('td', { texto: (p.nome || '—') + (sou ? ' (você)' : '') }),
        el('td', { texto: p.email }),
        el('td', {}, [papel]),
        el('td', { texto: new Date(p.criado_em).toLocaleDateString('pt-BR') }),
        el('td', {}, [sou ? null : el('button', { type: 'button', texto: 'Remover', onclick: async function () {
          if (!window.confirm('Remover o acesso de ' + p.email + '?')) return;
          try { await A.banco('acessos?email=eq.' + encodeURIComponent(p.email), { metodo: 'DELETE', cabecalhos: { Prefer: 'return=minimal' } }); msg('Acesso removido.', 'ok'); carregar(); }
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
    eu = String(ctx.email || '').toLowerCase();
    $('novo-acesso').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var email = $('a-email').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('Digite um e-mail válido.');
      try {
        await A.banco('acessos', { metodo: 'POST', corpo: { email: email, nome: $('a-nome').value.trim() || null, papel: $('a-papel').value }, cabecalhos: { Prefer: 'return=minimal' } });
        msg('Acesso liberado para ' + email + '. Avise a pessoa para entrar em "Área restrita → Primeiro acesso".', 'ok');
        $('a-email').value = ''; $('a-nome').value = '';
        carregar();
      } catch (e) { msg(e.message); }
    });
    try { await carregar(); } catch (e) { msg(e.message); }
  }

  A.proteger({ pagina: 'acessos.html', papelMinimo: 'dono', aoLiberar: iniciar });
})();
