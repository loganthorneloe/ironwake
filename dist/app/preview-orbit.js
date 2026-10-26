// Preview input is isolated from session and combat controls.
export function installPreviewOrbit({
  canvas: previewCanvas,
  isActive,
  rotatePreview,
  zoomPreview,
  resetButton,
  resetPreviewOrbit,
}) {
  let orbitPointer = null,
    orbitX = 0,
    orbitY = 0;

  previewCanvas.addEventListener('pointerdown', (e) => {
    if (!isActive()) return;
    orbitPointer = e.pointerId;
    orbitX = e.clientX;
    orbitY = e.clientY;
    previewCanvas.setPointerCapture(e.pointerId);
    previewCanvas.classList.add('dragging');
  });
  previewCanvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== orbitPointer) return;
    rotatePreview((e.clientX - orbitX) * 0.008, (e.clientY - orbitY) * 0.006);
    orbitX = e.clientX;
    orbitY = e.clientY;
  });
  function endOrbit() {
    orbitPointer = null;
    previewCanvas.classList.remove('dragging');
  }
  previewCanvas.addEventListener('pointerup', endOrbit);
  previewCanvas.addEventListener('pointercancel', endOrbit);
  previewCanvas.addEventListener(
    'wheel',
    (e) => {
      if (isActive()) {
        e.preventDefault();
        zoomPreview(e.deltaY * 0.008);
      }
    },
    { passive: false },
  );
  previewCanvas.addEventListener('keydown', (e) => {
    if (!isActive()) return;
    const v = {
      ArrowLeft: [-0.15, 0],
      ArrowRight: [0.15, 0],
      ArrowUp: [0, -0.1],
      ArrowDown: [0, 0.1],
    }[e.code];
    if (v) {
      e.preventDefault();
      rotatePreview(...v);
    }
    if (e.key === '+' || e.key === '-') {
      e.preventDefault();
      zoomPreview(e.key === '+' ? -1 : 1);
    }
  });
  resetButton.onclick = resetPreviewOrbit;
}
