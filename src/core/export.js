import { WIDTH, HEIGHT } from './model.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function exportPNG(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('PNG rendering failed.'));
      download(blob, filename || 'frame.png');
      resolve();
    }, 'image/png');
  });
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function exportWebM({ canvas, fps, start, end, render, progress }) {
  if (!window.MediaRecorder || !canvas.captureStream) throw new Error('WebM recording is not supported in this browser.');
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser has no supported WebM encoder.');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve, reject) => {
    recorder.onerror = event => reject(event.error || new Error('WebM recording failed.'));
    recorder.onstop = resolve;
  });
  recorder.start(100);
  try {
    const count = Math.max(1, end - start + 1);
    for (let frame = start; frame <= end; frame++) {
      render(frame);
      if (track && typeof track.requestFrame === 'function') track.requestFrame();
      if (progress) progress(frame - start + 1, count);
      await delay(1000 / Math.max(1, fps));
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach(trackItem => trackItem.stop());
  }
  await stopped;
  const blob = new Blob(chunks, { type: 'video/webm' });
  if (!blob.size) throw new Error('The recorder produced an empty video.');
  download(blob, 'animation.webm');
  return blob;
}

export async function exportMP4(options) {
  const webm = await exportWebM(options);
  if (options.progress) options.progress(options.end - options.start + 1, options.end - options.start + 1, 'Encoding MP4…');
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10'),
    import('https://esm.sh/@ffmpeg/util@0.12.2')
  ]);
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm')
  });
  await ffmpeg.writeFile('input.webm', await fetchFile(webm));
  await ffmpeg.exec(['-i', 'input.webm', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'output.mp4']);
  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data], { type: 'video/mp4' });
  download(blob, 'animation.mp4');
  await ffmpeg.deleteFile('input.webm').catch(() => {});
  await ffmpeg.deleteFile('output.mp4').catch(() => {});
  return blob;
}
