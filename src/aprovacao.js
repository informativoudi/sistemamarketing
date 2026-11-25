/* ============================================================
   Aprovação · textos e links usados no painel e no gerador
   O e-mail sai do Outlook de quem aprova (link mailto:), pelo
   endereço @unimeduberlandia.coop.br. O envio automático pelo
   Cloudflare fica para depois (precisa do plano pago e do domínio).
   ============================================================ */
(function (raiz) {
  'use strict';

  var STATUS = {
    aguardando: { nome: 'Aguardando aprovação', curto: 'Aguardando', classe: 'st-aguardando' },
    aprovada: { nome: 'Aprovada', curto: 'Aprovada', classe: 'st-aprovada' },
    reprovada: { nome: 'Precisa de ajustes', curto: 'Ajustar', classe: 'st-reprovada' },
    substituida: { nome: 'Substituída por nova versão', curto: 'Nova versão', classe: 'st-substituida' }
  };
  function status(s) { return STATUS[s] || STATUS.aguardando; }

  function base(sistema) {
    var b = (sistema && sistema.baseUrlPublica) || location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    // Testando no computador: o link aponta para o próprio site local.
    if (/^http:\/\/(localhost|127\.)/.test(location.href)) b = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    return b.replace(/\/?$/, '/');
  }
  function link(sistema, codigo, t, extra) {
    return base(sistema) + 'index.html?pedido=' + encodeURIComponent(codigo) + '&t=' + encodeURIComponent(t) + (extra || '');
  }

  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

  /* Monta o e-mail para quem pediu. p: { nome, email, titulo, codigo, formatoNome }
     d: { status, observacao, link, quem (quem aprovou), ajustada (Marketing fez nova versão) } */
  function mensagem(p, d) {
    p = Object.assign({}, p, { titulo: String(p.titulo || '').replace(/\*+/g, '').replace(/==/g, '') });
    var ola = 'Olá' + (primeiroNome(p.nome) ? ', ' + primeiroNome(p.nome) : '') + '!';
    var peca = '"' + (p.titulo || p.codigo) + '"' + (p.formatoNome ? ' (' + p.formatoNome + ')' : '');
    var assinatura = '\n\n' + (d.quem ? d.quem + '\n' : '') + 'Marketing e Comunicação · Unimed Uberlândia';
    var obs = String(d.observacao || '').trim();
    var assunto, corpo;
    if (d.status === 'reprovada') {
      assunto = 'Sua peça precisa de ajustes · ' + (p.titulo || p.codigo);
      corpo = ola + '\n\nConferimos a sua peça ' + peca + ' e ela precisa de alguns ajustes antes de ser aprovada.\n\n' +
        'O que ajustar:\n' + obs + '\n\n' +
        'Abra pelo link abaixo: o conteúdo já vem preenchido. É só corrigir e clicar em "Enviar nova versão".\n' + d.link +
        '\n\nCódigo da peça: ' + p.codigo + assinatura;
    } else {
      assunto = (d.atualizada ? 'Peça atualizada · ' : 'Peça aprovada · ') + (p.titulo || p.codigo);
      corpo = ola + '\n\n' + (d.atualizada
        ? 'Atualizamos a sua peça ' + peca + ' para o visual atual da marca e da campanha (Key Art). O conteúdo é o mesmo.\n\nA versão anterior deixa de valer: use só a nova.'
        : d.ajustada
        ? 'Fizemos alguns ajustes na sua peça ' + peca + ' e ela já está aprovada.'
        : 'Sua peça ' + peca + ' foi aprovada pelo Marketing.') +
        (obs ? '\n\nObservação:\n' + obs : '') +
        '\n\nBaixe a versão oficial por este link:\n' + d.link +
        '\n\nCódigo da peça: ' + p.codigo + ' (use só esta versão)' + assinatura;
    }
    return { para: p.email || '', assunto: assunto, corpo: corpo };
  }
  function mailto(m) {
    return 'mailto:' + encodeURIComponent(m.para || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(m.assunto) + '&body=' + encodeURIComponent(m.corpo);
  }

  /* Peças que a pessoa pediu neste aparelho (código + chave do link), para acompanhar. */
  var CHAVE_MINHAS = 'unimed-minhas-pecas-v1';
  function minhas() { try { return JSON.parse(localStorage.getItem(CHAVE_MINHAS) || '[]'); } catch (e) { return []; } }
  function guardarMinha(item) {
    try {
      var lista = minhas().filter(function (x) { return x.codigo !== item.codigo; });
      lista.unshift(item);
      localStorage.setItem(CHAVE_MINHAS, JSON.stringify(lista.slice(0, 20)));
    } catch (e) { /* sem armazenamento: segue sem a lista */ }
  }

  raiz.UnimedAprovacao = { status: status, STATUS: STATUS, link: link, mensagem: mensagem, mailto: mailto, minhas: minhas, guardarMinha: guardarMinha };
})(window);
