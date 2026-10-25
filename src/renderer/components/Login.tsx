import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { AuthState, LoginStep } from '../../shared/types';
import { lex } from '../lib/api';
import { Logo } from './Icons';

export function Login({ auth }: { auth: AuthState }) {
  const [step, setStep] = useState<LoginStep | null>(null);
  const [method, setMethod] = useState<'phone' | 'qr' | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrImg, setQrImg] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      lex.on('login:step', (s) => {
        setStep(s);
        setBusy(false);
        setValue('');
        if (s.step === 'qr') void QRCode.toDataURL(s.url, { margin: 1, width: 220, color: { dark: '#0b2a5a' } }).then(setQrImg);
        if (s.step === 'failed') setMethod(null);
      }),
    [],
  );

  useEffect(() => input.current?.focus(), [step]);

  const start = (m: 'phone' | 'qr') => {
    setMethod(m);
    setStep(null);
    setBusy(true);
    void lex.loginStart(m);
  };

  const cancel = () => {
    setMethod(null);
    setStep(null);
    setBusy(false);
    void lex.loginCancel();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    let v = value.trim();
    if (step?.step === 'phone') {
      v = v.replace(/[^\d+]/g, '');
      if (!v.startsWith('+')) v = (v.length <= 11 ? '+55' : '+') + v;
    }
    setBusy(true);
    void lex.loginAnswer(v);
  };

  if (auth === 'missing-keys') {
    return (
      <Shell>
        <div className="panel">
          <h2>Falta configurar o aplicativo</h2>
          <p>
            Este Lex Messenger foi gerado sem as chaves do Telegram. Quem gera o instalador precisa preencher o arquivo{' '}
            <code>.env</code> (veja o manual) e gerar o app de novo.
          </p>
        </div>
      </Shell>
    );
  }

  if (auth === 'connecting') {
    return (
      <Shell>
        <div className="spinner" />
        <p className="muted center">Conectando ao Telegram…</p>
      </Shell>
    );
  }

  const error = step && 'error' in step ? step.error : undefined;

  return (
    <Shell>
      {!method && (
        <>
          <p className="center intro">Entre com a sua conta do Telegram. Seus contatos e conversas aparecem aqui.</p>
          {step?.step === 'failed' && <p className="error">{step.error}</p>}
          {lex.features.mobile ? (
            <>
              <button className="btn btn-primary wide" onClick={() => start('phone')}>
                ☎️ Entrar com número de telefone
              </button>
              <p className="hint center">O Telegram manda um código para o app dele, neste mesmo celular.</p>
            </>
          ) : (
            <>
              <button className="btn btn-primary wide" onClick={() => start('qr')}>
                📱 Entrar com o celular (QR Code)
              </button>
              <p className="hint center">Mais fácil: é só apontar a câmera do Telegram.</p>
              <button className="btn wide" onClick={() => start('phone')}>
                ☎️ Entrar com número de telefone
              </button>
            </>
          )}
        </>
      )}

      {method && !step && (
        <>
          <div className="spinner" />
          <p className="muted center">Preparando…</p>
          <button className="btn wide" onClick={cancel}>
            Cancelar
          </button>
        </>
      )}

      {step?.step === 'qr' && (
        <div className="center">
          {qrImg && <img className="qr" src={qrImg} alt="QR Code para entrar" width={200} height={200} />}
          <ol className="steps">
            <li>Abra o Telegram no celular.</li>
            <li>
              Toque em <b>Configurações</b> → <b>Dispositivos</b>.
            </li>
            <li>
              Toque em <b>Conectar dispositivo</b> e aponte para este código.
            </li>
          </ol>
          {error && <p className="error">{error}</p>}
          <button className="btn wide" onClick={cancel}>
            Voltar
          </button>
        </div>
      )}

      {step && (step.step === 'phone' || step.step === 'code' || step.step === 'password') && (
        <form onSubmit={submit} className="login-form">
          {step.step === 'phone' && (
            <>
              <label htmlFor="v">Seu número de celular</label>
              <input ref={input} id="v" type="tel" placeholder="(91) 98888-7777" value={value} onChange={(e) => setValue(e.target.value)} />
              <p className="hint">Com DDD. De outro país? Comece com + e o código do país.</p>
            </>
          )}
          {step.step === 'code' && (
            <>
              <label htmlFor="v">Código de confirmação</label>
              <input
                ref={input}
                id="v"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="hint">{step.viaApp ? 'O Telegram enviou o código no próprio app, no celular.' : 'Enviamos o código por SMS.'}</p>
            </>
          )}
          {step.step === 'password' && (
            <>
              <label htmlFor="v">Senha de verificação em duas etapas</label>
              <input ref={input} id="v" type="password" value={value} onChange={(e) => setValue(e.target.value)} />
              {step.hint && <p className="hint">Dica: {step.hint}</p>}
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary wide" disabled={busy || !value.trim()}>
            {busy ? 'Aguarde…' : 'Continuar'}
          </button>
          <button type="button" className="btn wide" onClick={cancel}>
            Cancelar
          </button>
        </form>
      )}

      {step?.step === 'done' && (
        <>
          <div className="spinner" />
          <p className="muted center">Carregando seus contatos…</p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login">
      <div className="login-head">
        <Logo size={72} />
        <h1>
          Lex <span>Messenger</span>
        </h1>
      </div>
      <div className="login-body">{children}</div>
      <p className="login-foot">Suas mensagens vão direto entre este aparelho e o Telegram. Nada passa por outros servidores.</p>
    </div>
  );
}
