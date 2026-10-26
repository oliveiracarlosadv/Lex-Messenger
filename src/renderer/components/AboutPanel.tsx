import { lex } from '../lib/api';
import { Logo } from './Icons';

const REPO = 'https://github.com/oliveiracarlosadv/Lex-Messenger';

/** Diretrizes do Lex: o que ele é e o que ficou de fora de propósito. */
const PRINCIPLES: [string, string, string][] = [
  ['💬', 'Só conversa', 'Pessoas e grupos com quem você fala. Mais nada.'],
  ['🚫', 'Sem distrações', 'Sem stories, sem feed de canais, sem propaganda.'],
  ['🔒', 'Sem servidor no meio', 'O app fala direto com o Telegram. Nada passa por nós, nada é coletado.'],
  ['🙈', 'Nada guardado sem você pedir', 'Fotos e arquivos só vão para o aparelho quando você toca em “Salvar…”.'],
  ['🎁', 'Gratuito e livre', 'Sem assinatura e sem versão “pro”. Código aberto, licença GPL-3.0.'],
];

const LINKS: [string, string][] = [
  ['📖 Manual', `${REPO}/blob/main/docs/MANUAL.md`],
  ['🆕 Novidades', `${REPO}/blob/main/CHANGELOG.md`],
  ['🔐 Privacidade', `${REPO}/blob/main/docs/PRIVACIDADE.md`],
  ['📜 Termos de uso', `${REPO}/blob/main/docs/TERMOS.md`],
  ['⚖️ Licença GPL-3.0', `${REPO}/blob/main/LICENSE`],
  ['💻 Código-fonte', REPO],
];

/** Valores da Lex Tecnologias (Visão institucional). */
const VALUES = ['Feito por quem advoga', 'Simplicidade', 'Seus dados ficam com você', 'Sigilo e ética profissional', 'Tecnologia acessível'];

const PLATFORM: Record<string, string> = { mac: 'Mac', darwin: 'Mac', win32: 'Windows', windows: 'Windows', android: 'Android', ios: 'iPhone', web: 'Navegador' };

/** Tela “Sobre”: versão, diretrizes, autor, licença e links. */
export function AboutPanel() {
  const platform = PLATFORM[lex.platform] ?? lex.platform;
  return (
    <div className="lexabout-panel">
      <div className="lexabout-head">
        <Logo size={64} />
        <div>
          <h3>Lex Messenger</h3>
          <p className="lexabout-motto">Comunicação em primeiro lugar!</p>
          <p className="lexabout-version">
            Versão <b>{lex.version}</b> · {platform}
          </p>
        </div>
      </div>

      <p className="lexabout-intro">
        Um mensageiro para <b>conversar</b>, e só. Usa a sua conta do Telegram, pela API oficial, e fala com qualquer
        pessoa que tenha Telegram, use ela o Lex ou não.
      </p>

      <h4>Diretrizes</h4>
      <ul className="lexabout-principles">
        {PRINCIPLES.map(([icon, title, text]) => (
          <li key={title}>
            <span aria-hidden>{icon}</span>
            <div>
              <b>{title}</b>
              <span>{text}</span>
            </div>
          </li>
        ))}
      </ul>

      <h4>Quem fez</h4>
      <p>
        Idealizado e criado por <b>Carlos Alexandre Albuquerque Oliveira</b>, advogado, pela <b>Lex Tecnologias</b>.
      </p>

      <h4>Lex Tecnologias</h4>
      <p className="lexabout-intro">
        Uma <b>lawtech</b> de <b>Belém/PA</b>, criada por um advogado em atuação para resolver problemas que ele mesmo
        vive na rotina do escritório. O Lex Messenger nasceu da mesma ideia: conversar com clientes e equipe sem que o
        aplicativo dispute a sua atenção.
      </p>
      <blockquote className="lexabout-mission">
        <b>Missão:</b> devolver tempo e segurança ao advogado, com ferramentas simples, confiáveis e acessíveis.
      </blockquote>
      <ul className="lexabout-values">
        {VALUES.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
      <p className="hint">Também da Lex: Lex Calendário (agenda jurídica com prazos pelo CPC) e Lex Audio (transcrição de áudio offline).</p>

      <h4>Saiba mais</h4>
      <div className="lexabout-links">
        {LINKS.map(([label, url]) => (
          <button key={url} className="btn" onClick={() => lex.openExternal(url)}>
            {label}
          </button>
        ))}
      </div>

      <p className="hint lexabout-legal">
        © 2026 Carlos Alexandre Albuquerque Oliveira · Lex Tecnologias. Software livre sob a licença GPL-3.0: você pode
        usar, estudar, modificar e compartilhar, desde que mantenha aberto. O Lex Messenger é independente e não é
        afiliado ao Telegram nem à Microsoft; o visual é uma homenagem aos mensageiros clássicos, com desenhos e sons
        próprios.
      </p>
    </div>
  );
}
