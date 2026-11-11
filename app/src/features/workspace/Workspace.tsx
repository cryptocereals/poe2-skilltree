import { useState } from "react";
import App from "../../App";
import {
  DEFAULT_WORKSPACE_SELECTION,
  getWorkspaceGame,
  selectWorkspaceGame,
  selectWorkspaceSection,
  WORKSPACE_GAMES,
  WORKSPACE_SECTIONS,
} from "./navigation.mjs";
import type {
  WorkspaceGameId,
  WorkspaceSectionId,
  WorkspaceSelection,
} from "./navigation.mjs";
import Poe1TreeWorkspace from "../poe1/components/Poe1TreeWorkspace";

function SectionIcon({ section }: { section: WorkspaceSectionId }) {
  if (section === "atlas-tree") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m3.5 6 5-2.5 7 3 5-2.5v14l-5 2.5-7-3-5 2.5V6Z" />
        <path d="M8.5 3.5v14m7-11v14M6.5 9.5h1m8 3h1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v5m0 0-5 4m5-4 5 4m-10 0v5m10-5v5" />
      <circle cx="12" cy="3.5" r="1.5" />
      <circle cx="7" cy="14" r="1.5" />
      <circle cx="17" cy="14" r="1.5" />
      <circle cx="7" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="m16 3 10 5.5v15L16 29 6 23.5v-15L16 3Z" />
      <path d="M16 8v16m-6-11 6 3 6-3" />
      <circle cx="16" cy="8" r="1.5" />
      <circle cx="10" cy="13" r="1.5" />
      <circle cx="22" cy="13" r="1.5" />
      <circle cx="16" cy="24" r="1.5" />
    </svg>
  );
}

function AtlasComingSoon({
  game,
  onReturn,
}: {
  game: WorkspaceGameId;
  onReturn: () => void;
}) {
  const gameLabel = getWorkspaceGame(game).label;
  return (
    <div className="atlas-landing">
      <article className="atlas-card">
        <div className="atlas-card__top">
          <span className="atlas-card__icon">
            <SectionIcon section="atlas-tree" />
          </span>
          <span className="atlas-card__status" role="status">
            <span className="atlas-card__status-dot" />
            Coming soon
          </span>
        </div>

        <div className="atlas-card__copy">
          <p className="atlas-card__eyebrow">Endgame planning</p>
          <h1 id="atlas-tree-heading">Atlas Tree</h1>
          <p>
            Atlas planning for {gameLabel} isn’t available yet. This space is
            reserved for a future endgame progression tool.
          </p>
        </div>

        <div className="atlas-card__divider" />

        <div className="atlas-card__bottom">
          <span>For now, continue with the passive skill tree planner.</span>
          <button type="button" className="atlas-card__return" onClick={onReturn}>
            <SectionIcon section="skill-tree" />
            Skill Tree
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10h12m-5-5 5 5-5 5" />
            </svg>
          </button>
        </div>
      </article>
    </div>
  );
}

export default function Workspace() {
  const [selection, setSelection] = useState<WorkspaceSelection>(
    DEFAULT_WORKSPACE_SELECTION,
  );
  const [poe1TreeVisited, setPoe1TreeVisited] = useState(false);
  const { game, section: activeSection } = selection;
  const active = WORKSPACE_SECTIONS.find(
    (section) => section.id === activeSection,
  ) ?? WORKSPACE_SECTIONS[0];
  const activeGame = getWorkspaceGame(game);
  const isSkillTree = activeSection === "skill-tree";
  const isPoe2Tree = isSkillTree && game === "poe2";
  const isPoe1Tree = isSkillTree && game === "poe1";

  const chooseGame = (nextGame: WorkspaceGameId) => {
    setSelection((current) => selectWorkspaceGame(current, nextGame));
    if (nextGame === "poe1" && isSkillTree) setPoe1TreeVisited(true);
  };
  const chooseSection = (nextSection: WorkspaceSectionId) => {
    setSelection((current) => selectWorkspaceSection(current, nextSection));
    if (nextSection === "skill-tree" && game === "poe1") {
      setPoe1TreeVisited(true);
    }
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <span className="workspace-brand__mark">
            <BrandMark />
          </span>
          <span className="workspace-brand__copy">
            <span className="workspace-brand__name">Exile Planner</span>
            <span className="workspace-brand__caption">Build workspace</span>
          </span>
        </div>

        <nav className="workspace-sidebar__nav" aria-label="Workspace">
          <p className="workspace-sidebar__label">Planning tools</p>
          <div className="workspace-nav">
            {WORKSPACE_SECTIONS.map((section) => {
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={
                    "workspace-nav__item" +
                    (selected ? " workspace-nav__item--active" : "")
                  }
                  aria-label={section.label}
                  aria-current={selected ? "page" : undefined}
                  title={section.label}
                  onClick={() => chooseSection(section.id)}
                >
                  <span className="workspace-nav__icon">
                    <SectionIcon section={section.id} />
                  </span>
                  <span className="workspace-nav__label">{section.label}</span>
                  {section.status === "coming-soon" && (
                    <span className="workspace-nav__badge" aria-hidden="true">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="workspace-sidebar__footer">
          <span className="workspace-sidebar__footer-mark" aria-hidden="true">
            <span />
          </span>
          <span className="workspace-sidebar__footer-copy">
            {activeGame.label}
            <small>{active.label} workspace</small>
          </span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-header">
          <nav className="workspace-header__breadcrumb" aria-label="Breadcrumb">
            <span className="workspace-header__root">Workspace</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
            <span className="workspace-header__current" aria-current="page">
              {active.label}
            </span>
          </nav>
          <div className="workspace-header__game-switch" role="group" aria-label="Game">
            {WORKSPACE_GAMES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={game === option.id}
                title={option.label}
                onClick={() => chooseGame(option.id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <div className="workspace-header__context">
            <span className="workspace-header__context-mark">
              {game.toUpperCase()}
            </span>
            <span>{activeGame.label}</span>
          </div>
        </header>

        <main
          className="workspace-stage"
          aria-label={`${active.label} workspace`}
        >
          <section
            className="workspace-view__tree"
            hidden={!isPoe2Tree}
            aria-hidden={!isPoe2Tree}
          >
            <App />
          </section>
          <section
            className="workspace-view__tree workspace-view__tree--poe1"
            hidden={!isPoe1Tree}
            aria-hidden={!isPoe1Tree}
            aria-label="Path of Exile 1 skill tree"
          >
            {poe1TreeVisited && <Poe1TreeWorkspace />}
          </section>
          <section
            className="workspace-view__atlas"
            hidden={isSkillTree}
            aria-hidden={isSkillTree}
            aria-labelledby="atlas-tree-heading"
          >
            <AtlasComingSoon
              game={game}
              onReturn={() => chooseSection("skill-tree")}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
