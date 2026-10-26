import {
  REPORT_REPO,
  REPORT_FIELDS,
  MAX_AUDIO,
  MAX_SCREENSHOT,
  validateReport,
} from './feedback-schema.js';
const endpoint = new URL('api/feedback', new URL('.', import.meta.url));
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// Called immediately after the game's render, while WebGL's drawing buffer is valid.
// Copy synchronously, then encode asynchronously; no preserveDrawingBuffer performance penalty.
export function createFrameCapture() {
  let pending = null;
  return {
    request() {
      return new Promise((resolve) => {
        if (pending) pending(null);
        pending = resolve;
        setTimeout(() => {
          if (pending === resolve) {
            pending = null;
            resolve(null);
          }
        }, 2500);
      });
    },
    frame(source) {
      if (!pending || !source?.width || !source?.height) return;
      const resolve = pending;
      pending = null;
      try {
        const copy = document.createElement('canvas'),
          scale = Math.min(1, 1600 / source.width);
        copy.width = Math.round(source.width * scale);
        copy.height = Math.round(source.height * scale);
        copy.getContext('2d').drawImage(source, 0, 0, copy.width, copy.height);
        copy.toBlob(
          (blob) => resolve(blob?.size <= MAX_SCREENSHOT ? blob : null),
          'image/jpeg',
          0.8,
        );
      } catch {
        resolve(null);
      }
    },
  };
}

export function installFeedback({ capture, context, onOpen, onClose }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'feedbackDialog';
  dialog.setAttribute('aria-labelledby', 'feedbackHeading');
  document.body.append(dialog);
  dialog.innerHTML = `<button type="button" class="close" id="feedbackClose" aria-label="Close report">×</button>
 <p class="overline">PILOT FEEDBACK / F8</p><h2 id="feedbackHeading">Make the next sortie better.</h2>
 <div class="feedback-kinds" role="group" aria-label="Report type"><button type="button" data-kind="bug" aria-pressed="true">Report a bug</button><button type="button" data-kind="suggestion" aria-pressed="false">Suggest an improvement</button></div>
 <p class="feedback-note">Screenshot captured automatically. Add text, a voice report, or both. Cover the prompts below in your recording if you prefer to speak.</p>
 <form id="feedbackForm"><div class="feedback-layout"><div class="feedback-fields">
 <label>Short title<input name="title" minlength="5" maxlength="140" required placeholder="Give this report a clear name"></label>
 ${REPORT_FIELDS.bug.map(([key, label]) => `<label><span data-label="${key}">${label}</span><textarea name="${key}" rows="2" maxlength="${{ details: 4000, steps: 3000, expected: 2000, actual: 2000 }[key]}"></textarea></label>`).join('')}
 <div class="feedback-pair"><label><span id="feedbackFrequencyLabel">How often?</span><select name="frequency"><option>First time</option><option>Sometimes</option><option>Every time</option><option>Not sure</option></select></label><label><span id="feedbackSeverityLabel">Impact</span><select name="severity"><option>Minor</option><option>Disrupts play</option><option>Blocks progress</option><option>Crash / cannot play</option></select></label></div></div>
 <aside class="feedback-evidence"><h3>Captured game view</h3><img id="feedbackScreenshot" alt="Game view captured when the report opened" hidden><p id="feedbackCaptureStatus" role="status">Capturing game view…</p><button type="button" id="feedbackRetake">Retake screenshot</button>
 <h3>Voice report <span>optional · 60 sec max</span></h3><button type="button" id="feedbackRecord">Record voice report</button><p id="feedbackAudioStatus" role="status">The microphone starts only when you press Record.</p><audio id="feedbackAudio" controls hidden></audio><button type="button" id="feedbackRemoveAudio" hidden>Remove recording</button>
 <details><summary>Included game context</summary><pre id="feedbackContext"></pre></details></aside></div>
 <label class="feedback-consent"><input name="consent" type="checkbox" required>I have reviewed this report. Its text, screenshot, voice recording and game context will be public on GitHub.</label>
 <p id="feedbackStatus" role="status" aria-live="polite"></p><div class="feedback-actions"><button type="button" id="feedbackCancel">Save draft &amp; close</button><button class="button primary" id="feedbackSubmit" type="submit">Submit bug to GitHub</button></div></form>
 <div id="feedbackSuccess" hidden><h3>Report received.</h3><p>Thank you for helping improve IRONWAKE.</p><a id="feedbackIssue" target="_blank" rel="noopener noreferrer">View GitHub issue ↗</a><button type="button" id="feedbackDone">Return to game</button></div>`;
  const $ = (selector) => dialog.querySelector(selector),
    form = $('#feedbackForm');
  let kind = 'bug',
    id = crypto.randomUUID(),
    gameContext = null,
    screenshot = null,
    audio = null,
    screenshotUrl = null,
    audioUrl = null,
    recorder = null,
    stream = null,
    timer = null,
    recordToken = 0,
    recording = false,
    requesting = false,
    submitting = false,
    uncertain = false,
    submitted = false,
    capturing = false,
    available = null,
    captureToken = 0;
  const status = (message) => {
    $('#feedbackStatus').textContent = message;
  };
  const busy = () => submitting || recording || requesting || capturing;
  function sync() {
    $('#feedbackSubmit').disabled = busy() || uncertain || available === false;
    $('#feedbackSubmit').textContent = submitting
      ? 'Sending report…'
      : `Submit ${kind === 'bug' ? 'bug' : 'suggestion'} to GitHub`;
    $('#feedbackRetake').disabled = submitting || capturing || uncertain;
    $('#feedbackRecord').disabled = submitting || requesting || uncertain;
    $('#feedbackRemoveAudio').disabled = submitting || recording || requesting || uncertain;
    for (const [key] of REPORT_FIELDS[kind]) form.elements[key].required = !audio;
  }
  function setKind(next) {
    kind = next;
    for (const [key, label] of REPORT_FIELDS[kind]) $(`[data-label="${key}"]`).textContent = label;
    dialog
      .querySelectorAll('[data-kind]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.kind === kind)),
      );
    $('#feedbackFrequencyLabel').textContent =
      kind === 'bug' ? 'How often?' : 'How often would this help?';
    $('#feedbackSeverityLabel').textContent = kind === 'bug' ? 'Impact' : 'Priority';
    const options =
      kind === 'bug'
        ? ['Minor', 'Disrupts play', 'Blocks progress', 'Crash / cannot play']
        : ['Nice to have', 'Helpful', 'High priority'];
    form.elements.severity.replaceChildren(...options.map((value) => new Option(value, value)));
    sync();
  }
  function revoke(which) {
    if (which === 'screenshot' && screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      screenshotUrl = null;
    }
    if (which === 'audio' && audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
  }
  async function takeScreenshot() {
    const token = ++captureToken;
    capturing = true;
    $('#feedbackCaptureStatus').textContent = 'Capturing game view…';
    sync();
    gameContext = context();
    $('#feedbackContext').textContent = JSON.stringify(gameContext, null, 2);
    const blob = await capture();
    if (token !== captureToken) return;
    revoke('screenshot');
    screenshot = blob;
    capturing = false;
    $('#feedbackScreenshot').hidden = !blob;
    if (blob) {
      screenshotUrl = URL.createObjectURL(blob);
      $('#feedbackScreenshot').src = screenshotUrl;
    }
    $('#feedbackCaptureStatus').textContent = blob
      ? 'Captured automatically. Review before sending.'
      : 'Game capture unavailable. You can still report with the included game context.';
    sync();
  }
  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    clearInterval(timer);
    timer = null;
  }
  async function record() {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      $('#feedbackAudioStatus').textContent =
        'Voice recording is unavailable in this browser. Use the text prompts.';
      return;
    }
    const token = ++recordToken;
    requesting = true;
    sync();
    $('#feedbackAudioStatus').textContent = 'Waiting for microphone permission…';
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== recordToken || !dialog.open) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = mic;
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime) throw new Error('unsupported');
      recorder = new MediaRecorder(mic, { mimeType: mime, audioBitsPerSecond: 48000 });
      const chunks = [];
      let size = 0,
        failed = false;
      const start = performance.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size) {
          size += e.data.size;
          if (size <= MAX_AUDIO) chunks.push(e.data);
          else {
            failed = true;
            stopRecording();
          }
        }
      };
      recorder.onerror = () => {
        failed = true;
        stopRecording();
      };
      recorder.onstop = () => {
        stopRecording();
        recording = false;
        $('#feedbackRecord').textContent = 'Record again';
        if (token !== recordToken) {
          sync();
          return;
        }
        if (!failed && size > 0) {
          revoke('audio');
          audio = new Blob(chunks, { type: mime.split(';')[0] });
          audioUrl = URL.createObjectURL(audio);
          $('#feedbackAudio').src = audioUrl;
          $('#feedbackAudio').hidden = false;
          $('#feedbackRemoveAudio').hidden = false;
          $('#feedbackAudioStatus').textContent = 'Recording attached. Listen before sending.';
        } else
          $('#feedbackAudioStatus').textContent =
            'Recording failed or exceeded 2 MB. Try again or use text.';
        sync();
      };
      recorder.start(250);
      recording = true;
      $('#feedbackRecord').textContent = 'Stop recording';
      timer = setInterval(() => {
        const seconds = Math.floor((performance.now() - start) / 1000);
        $('#feedbackAudioStatus').textContent = `Recording · ${seconds} / 60 sec`;
        if (seconds >= 60) stopRecording();
      }, 250);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      $('#feedbackAudioStatus').textContent =
        'Microphone unavailable or permission denied. You can still use text.';
    } finally {
      if (token === recordToken) {
        requesting = false;
        sync();
      }
    }
  }
  function close() {
    if (submitting) return;
    dialog.close();
  }
  dialog.addEventListener('cancel', (event) => {
    if (submitting) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    ++recordToken;
    requesting = false;
    stopRecording();
    $('#feedbackAudio').pause();
    const label = document.querySelector('#buildLabel');
    if (label && label.parentElement === dialog)
      (document.querySelector('#modal[open]') || document.body).append(label);
    onClose?.();
  });
  $('#feedbackClose').onclick = $('#feedbackCancel').onclick = $('#feedbackDone').onclick = close;
  $('#feedbackRetake').onclick = takeScreenshot;
  $('#feedbackRecord').onclick = record;
  $('#feedbackRemoveAudio').onclick = () => {
    revoke('audio');
    audio = null;
    $('#feedbackAudio').removeAttribute('src');
    $('#feedbackAudio').hidden = true;
    $('#feedbackRemoveAudio').hidden = true;
    $('#feedbackAudioStatus').textContent =
      'Recording removed. Fill out the text prompts or record again.';
    sync();
  };
  dialog.querySelectorAll('[data-kind]').forEach(
    (button) =>
      (button.onclick = () => {
        if (!submitting && !uncertain) setKind(button.dataset.kind);
      }),
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy() || uncertain || submitted || available === false) return;
    let report;
    try {
      report = validateReport(
        { ...Object.fromEntries(new FormData(form)), kind, context: gameContext },
        !!audio,
      );
    } catch (error) {
      status(error.message);
      return;
    }
    const data = new FormData();
    data.set('report', JSON.stringify(report));
    if (screenshot) data.set('screenshot', screenshot, 'screenshot.jpg');
    if (audio) data.set('audio', audio, 'voice');
    submitting = true;
    status('Sending your report and attachments…');
    sync();
    // Lock editing during upload so a retry cannot silently send a different report.
    const editable = [...form.querySelectorAll('input,textarea,select')];
    editable.forEach((el) => (el.disabled = true));
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-Report-ID': id },
        body: data,
        signal: AbortSignal.timeout(45000),
      });
      const result = await response.json();
      uncertain = !!result.uncertain;
      if (!response.ok)
        throw new Error(result.error || 'Could not send report. Your draft is still here.');
      if (!new RegExp(`^https://github.com/${REPORT_REPO}/issues/[0-9]+$`).test(result.url))
        throw new Error('Invalid GitHub receipt. Your draft is still here.');
      submitted = true;
      form.hidden = true;
      $('#feedbackSuccess').hidden = false;
      $('#feedbackIssue').href = result.url;
      $('#feedbackIssue').focus();
    } catch (error) {
      status(
        (error.name === 'TimeoutError'
          ? 'Connection timed out. Retry to check the same report; a confirmed report will not be duplicated.'
          : error.message) + (uncertain ? ` Issues: https://github.com/${REPORT_REPO}/issues` : ''),
      );
    } finally {
      submitting = false;
      editable.forEach((el) => (el.disabled = false));
      sync();
    }
  };
  async function open() {
    if (dialog.open) return;
    if (submitted) {
      form.reset();
      form.hidden = false;
      $('#feedbackSuccess').hidden = true;
      submitted = false;
      uncertain = false;
      id = crypto.randomUUID();
      revoke('audio');
      audio = null;
      $('#feedbackAudio').hidden = true;
      $('#feedbackRemoveAudio').hidden = true;
      setKind('bug');
    }
    onOpen();
    dialog.showModal();
    const label = document.querySelector('#buildLabel');
    if (label) dialog.append(label);
    status(uncertain ? 'Check GitHub issues for the previous report before starting another.' : '');
    if (!uncertain) takeScreenshot();
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      const config = await response.json();
      available = !!config.available;
      if (!available)
        status(
          'Direct reporting is not configured on this server yet. You can prepare a draft here.',
        );
    } catch {
      available = null;
      status('Could not check reporting availability. You can prepare a report and retry sending.');
    }
    sync();
  }
  document
    .querySelectorAll('[data-feedback]')
    .forEach((button) => button.addEventListener('click', open));
  window.addEventListener(
    'keydown',
    (event) => {
      if (
        event.code === 'F8' &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open();
      }
    },
    true,
  );
  window.addEventListener('pagehide', () => {
    ++recordToken;
    stopRecording();
    revoke('audio');
    revoke('screenshot');
  });
  return { open, isOpen: () => dialog.open };
}
