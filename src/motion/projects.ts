import gsap from 'gsap';
import type { Project } from '../data/projects';

/** Case study dialog: cards open into it. Works without motion, animates from the card when allowed. */
export function setupProjects(animate: boolean) {
  const dialog = document.querySelector<HTMLDialogElement>('[data-case]');
  const dataEl = document.getElementById('projects-data');
  if (!dialog || !dataEl) return;

  const projects: Project[] = JSON.parse(dataEl.textContent ?? '[]');
  const panel = dialog.querySelector<HTMLElement>('[data-case-panel]')!;
  const fill = (sel: string, text: string) => {
    dialog.querySelector(sel)!.textContent = text;
  };
  let opener: HTMLElement | null = null;

  const cardRect = () => opener?.getBoundingClientRect();

  const open = (card: HTMLElement) => {
    const project = projects.find((p) => p.id === card.dataset.project);
    if (!project) return;
    opener = card;
    fill('[data-case-title]', project.title);
    fill('[data-case-problem]', project.caseStudy.problem);
    fill('[data-case-approach]', project.caseStudy.approach);
    fill('[data-case-outcome]', project.caseStudy.outcome);
    dialog.showModal();

    const from = cardRect();
    if (animate && from) {
      const to = panel.getBoundingClientRect();
      const scale = Math.min(from.width / to.width, 1);
      gsap.fromTo(
        panel,
        {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale,
          opacity: 0,
        },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out', overwrite: true },
      );
    }
  };

  const close = () => {
    const finish = () => {
      dialog.close();
      opener?.focus();
    };
    const to = cardRect();
    if (animate && to) {
      const from = panel.getBoundingClientRect();
      gsap.to(panel, {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: Math.min(to.width / from.width, 1),
        opacity: 0,
        duration: 0.45,
        ease: 'power2.in',
        overwrite: true,
        onComplete: finish,
      });
    } else {
      finish();
    }
  };

  document.querySelectorAll<HTMLElement>('[data-project]').forEach((card) => card.addEventListener('click', () => open(card)));
  dialog.querySelector('[data-case-close]')!.addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
}
