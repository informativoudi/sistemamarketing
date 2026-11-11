/* ============================================================
   Modelo: E-mail marketing
   Recebe o plano do motor e devolve o HTML do e-mail, em tabelas
   e estilos inline para funcionar no Outlook, Gmail e Apple Mail.
   ============================================================ */
(function (raiz) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function url(base, caminho) {
    if (/^https?:\/\//.test(caminho)) return caminho;
    return (base || '').replace(/\/?$/, '/') + caminho.replace(/^\//, '');
  }

  function render(plano, dados, marca, opcoes) {
    opcoes = opcoes || {};
    var c = marca.cores;
    var fonte = marca.tipografia.familia;
    var base = opcoes.baseUrl || '';
    var codigo = opcoes.codigo || 'UNI-EM-PREVIA';
    var raioCard = plano.flags.molduraBox ? marca.forma.raioCard : '12px';
    var raioBotao = plano.flags.molduraBox ? marca.forma.raioBotao : '24px';
    var corBotao = plano.tema.nome === 'Aviso' ? c.laranjaEscuro : c.institucional;

    var titulo = esc(dados.titulo).replace(/[.!]\s*$/, '');
    var transform = plano.flags.tituloContraste ? 'text-transform:uppercase;letter-spacing:-0.5px;' : '';
    var quadrado = plano.flags.quadradoLaranja ? '<span style="color:' + c.laranja + ';">&#9632;</span>' : '';

    function botao() {
      if (!plano.botao) return '';
      return '' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>' +
        '<td bgcolor="' + corBotao + '" style="background:' + corBotao + ';border-radius:' + raioBotao + ';">' +
        '<a href="' + esc(plano.botao.link) + '" target="_blank" style="display:inline-block;padding:15px 26px;font-family:' + fonte + ';font-size:16px;font-weight:bold;line-height:1;color:#ffffff;text-decoration:none;border-radius:' + raioBotao + ';">' +
        esc(plano.botao.texto) + ' &rarr;</a></td></tr></table>';
    }

    function blocoData() {
      if (!plano.data) return '';
      var d = plano.data.info;
      var linhas = [esc(d.semana.charAt(0).toUpperCase() + d.semana.slice(1)) + ', ' + d.dia + ' de ' + esc(d.mesLongo) + ' de ' + d.ano];
      if (plano.data.hora) linhas.push(esc(plano.data.hora));
      if (plano.data.local) linhas.push(esc(plano.data.local));
      var grande = plano.data.grande;
      return '' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:' + (grande ? '4px 0 24px' : '8px 0 24px') + ';"><tr>' +
        '<td bgcolor="' + c.fundoPagina + '" style="background:' + c.fundoPagina + ';border-radius:' + raioCard + ';padding:' + (grande ? '20px 22px' : '14px 18px') + ';">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td valign="middle" style="padding-right:18px;border-right:3px solid ' + plano.tema.destaque + ';font-family:' + fonte + ';text-align:center;">' +
        '<div style="font-size:' + (grande ? 44 : 30) + 'px;font-weight:bold;line-height:1;color:' + plano.tema.destaque + ';">' + d.dia + '</div>' +
        '<div style="font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:' + c.textoForte + ';padding-top:4px;">' + esc(d.mes) + '</div></td>' +
        '<td valign="middle" style="padding-left:18px;font-family:' + fonte + ';font-size:' + (grande ? 16 : 15) + 'px;line-height:1.5;color:' + c.texto + ';">' +
        linhas.map(function (l, i) { return i === 0 ? '<strong style="color:' + c.textoForte + ';">' + l + '</strong>' : l; }).join('<br>') +
        '</td></tr></table></td></tr></table>';
    }

    var corpo = '';
    var botaoColocado = false;
    plano.blocos.forEach(function (b, i) {
      if (b.tipo === 'intertitulo') {
        corpo += '<h2 style="margin:28px 0 8px;font-family:' + fonte + ';font-size:19px;line-height:1.25;font-weight:bold;color:' + c.textoForte + ';">' + esc(b.texto) + '</h2>';
      } else {
        corpo += '<p style="margin:0 0 16px;font-family:' + fonte + ';font-size:16px;line-height:1.6;color:' + c.texto + ';">' + esc(b.texto) + '</p>';
      }
      if (plano.botao && plano.botao.repetir && i === 0) { corpo += botao(); botaoColocado = true; }
    });

    var imagem = '';
    if (plano.imagem) {
      imagem = '<tr><td style="padding:0 32px 8px;"><img src="' + esc(url(base, plano.imagem.arquivo)) + '" width="536" alt="' + esc(plano.imagem.descricao) + '" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:' + (plano.flags.molduraBox ? '16px 16px 0 16px' : '0') + ';"></td></tr>';
    }

    var subtitulo = dados.subtitulo ? '<p style="margin:0 0 20px;font-family:' + fonte + ';font-size:18px;line-height:1.45;color:' + c.textoSuave + ';">' + esc(dados.subtitulo) + '</p>' : '';
    var preheader = esc(dados.subtitulo || (plano.blocos[0] ? plano.blocos[0].texto.slice(0, 110) : ''));
    var logo = url(base, marca.logos.claro);
    var alturaLogo = 40;

    var prova = plano.flags.provaDeProcesso
      ? '<tr><td style="padding:14px 32px 0;font-family:' + fonte + ';font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:' + c.citrico + ';">' + esc(codigo) + ' &middot; ' + esc(marca.rodape.coordenadas) + '</td></tr>'
      : '';

    var conteudo;
    if (plano.variante === 'curto') {
      conteudo = '<h1 style="margin:0 0 20px;font-family:' + fonte + ';font-size:' + plano.tituloPx + 'px;line-height:1.05;font-weight:900;' + transform + 'color:' + c.textoForte + ';">' + titulo + quadrado + '</h1>' +
        subtitulo + blocoData() + corpo + (botaoColocado ? '' : botao());
    } else {
      conteudo = '<h1 style="margin:0 0 16px;font-family:' + fonte + ';font-size:' + plano.tituloPx + 'px;line-height:1.08;font-weight:900;' + transform + 'color:' + c.textoForte + ';">' + titulo + quadrado + '</h1>' +
        subtitulo + blocoData() + corpo + (botaoColocado ? '' : botao());
    }

    return '' +
'<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="x-apple-disable-message-reformatting">\n<title>' + titulo + '</title>\n</head>\n' +
'<body style="margin:0;padding:0;background:' + c.fundoPagina + ';">\n' +
'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + preheader + '</div>\n' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + c.fundoPagina + '" style="background:' + c.fundoPagina + ';"><tr><td align="center" style="padding:24px 12px;">\n' +
'<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;">\n' +
'<tr><td height="6" bgcolor="' + plano.tema.faixa + '" style="height:6px;line-height:6px;font-size:0;background:' + plano.tema.faixa + ';">&nbsp;</td></tr>\n' +
'<tr><td style="padding:24px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
'<td valign="middle"><img src="' + esc(logo) + '" height="' + alturaLogo + '" width="' + Math.round(alturaLogo * marca.logos.proporcao) + '" alt="Unimed Uberlândia" style="display:block;border:0;"></td>' +
'<td valign="middle" align="right" style="font-family:' + fonte + ';font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:' + c.textoSuave + ';">' + esc(plano.tema.rotulo) + '</td>' +
'</tr></table></td></tr>\n' +
imagem + '\n' +
'<tr><td style="padding:24px 32px 16px;">' + conteudo + '</td></tr>\n' +
'<tr><td bgcolor="' + c.petroleo + '" style="background:' + c.petroleo + ';padding:0 0 22px;">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + prova +
'<tr><td style="padding:12px 32px 0;font-family:' + fonte + ';font-size:13px;line-height:1.6;color:#ffffff;"><strong>' + esc(marca.rodape.assinatura) + '</strong><br><span style="color:rgba(255,255,255,0.78);">' + esc(marca.rodape.site) + '</span></td></tr>' +
'</table></td></tr>\n' +
'</table>\n</td></tr></table>\n</body>\n</html>\n';
  }

  var api = { render: render, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { raiz.UnimedModelos = raiz.UnimedModelos || {}; raiz.UnimedModelos['email-marketing'] = api; }
})(typeof window !== 'undefined' ? window : this);
