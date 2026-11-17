import { useEffect, useRef } from 'preact/hooks';

/** A decorative scene. Documents and controls never move with the pointer. */
export function OfficeScene({ screen }: { screen: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = ref.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0, y = 0;
    const paint = () => {
      frame = 0;
      scene.style.setProperty('--scene-x', `${x.toFixed(2)}px`);
      scene.style.setProperty('--scene-y', `${y.toFixed(2)}px`);
    };
    const reset = () => { x = 0; y = 0; cancelAnimationFrame(frame); paint(); };
    const preference = () => { scene.dataset.motion = reduced.matches ? 'off' : 'on'; if (reduced.matches) reset(); };
    const visibility = () => { scene.dataset.suspended = document.hidden ? 'true' : 'false'; if (document.hidden) reset(); };
    const move = (event: PointerEvent) => {
      if (reduced.matches || document.hidden || event.pointerType !== 'mouse') return;
      // The nearest layer moves at most sqrt(5.5² + 4²) = 6.81 pixels.
      x = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1)) * 5.5;
      y = Math.max(-1, Math.min(1, event.clientY / innerHeight * 2 - 1)) * 4;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    preference(); visibility();
    reduced.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', reset);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener('change', preference);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', reset);
    };
  }, []);
  const url = (name: string) => `${import.meta.env.BASE_URL}assets/scene-${name}.svg`;
  return <div ref={ref} class={`office-scene office-scene--${screen}`} aria-hidden="true">
    <img class="scene-layer scene-room" src={url('room')} width="1600" height="1000" alt=""/>
    <img class="scene-layer scene-desk" src={url('desk')} width="1600" height="1000" alt=""/>
    <img class="scene-layer scene-light" src={url('light')} width="1600" height="1000" alt=""/>
    <img class="scene-layer scene-lamp" src={url('lamp')} width="1600" height="1000" alt=""/>
    <img class="scene-layer scene-props" src={url('props')} width="1600" height="1000" alt=""/>
    <div class="scene-dust">{Array.from({ length: 20 }, (_, i) => <i key={i} style={`left:${45 + (i * 17 % 48)}%;top:${26 + (i * 13 % 63)}%;--delay:-${i * 1.37}s;--duration:${12 + i % 7}s`}/>)}</div>
    <div class="scene-vignette"/>
  </div>;
}
