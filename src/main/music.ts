// Descobre a música que está tocando no computador.
// Mac: Spotify e Apple Music (pede permissão de "Automação" na primeira vez).
// Windows: o player que estiver tocando, pelos controles de mídia do sistema.
import { execFile } from 'node:child_process';

import { MusicPermissionError, type NowPlaying } from '../core/presence';

function run(cmd: string, args: string[], timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stderr: String(stderr) }));
      resolve(String(stdout).trim());
    }),
  );
}

async function isRunning(name: string): Promise<boolean> {
  try {
    await run('pgrep', ['-x', name], 2000);
    return true;
  } catch {
    return false;
  }
}

async function macPlayer(bundleId: string): Promise<NowPlaying> {
  const script = `tell application id "${bundleId}"
  if player state is playing then return (name of current track) & tab & (artist of current track)
end tell
return ""`;
  try {
    const out = await run('osascript', ['-e', script]);
    if (!out) return null;
    const [title, artist = ''] = out.split('\t');
    return title ? { title, artist } : null;
  } catch (e) {
    // -1743: o usuário não deu permissão para controlar o app de música.
    if (/-1743|not allowed|Não é permitido/i.test((e as { stderr?: string }).stderr ?? '')) throw new MusicPermissionError();
    return null;
  }
}

const WIN_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$s = $mgr.GetCurrentSession()
if ($s -and $s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') {
  $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output ("{0}\`t{1}" -f $p.Title, $p.Artist)
}`;

async function winPlayer(): Promise<NowPlaying> {
  try {
    const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WIN_SCRIPT], 8000);
    if (!out) return null;
    const [title, artist = ''] = out.split('\t');
    return title ? { title, artist } : null;
  } catch {
    return null;
  }
}

export async function nowPlaying(): Promise<NowPlaying> {
  if (process.platform === 'darwin') {
    if (await isRunning('Spotify')) {
      const s = await macPlayer('com.spotify.client');
      if (s) return s;
    }
    if (await isRunning('Music')) return macPlayer('com.apple.Music');
    return null;
  }
  if (process.platform === 'win32') return winPlayer();
  return null;
}
