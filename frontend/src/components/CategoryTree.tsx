import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Search, X } from "lucide-react";
import { CategoryTree as ICategoryTree, catName } from "../api";
import { useLang } from "../contexts/LanguageContext";

interface Props {
  nodes: ICategoryTree[];
  selected: string;
  onSelect: (slug: string) => void;
  depth?: number;
  counts?: Record<string, number>;
}

function matchesSearch(node: ICategoryTree, q: string, lang: string): boolean {
  if (catName(node, lang).toLowerCase().includes(q)) return true;
  return node.children.some((c) => matchesSearch(c, q, lang));
}

function filterTree(nodes: ICategoryTree[], q: string, lang: string): ICategoryTree[] {
  return nodes
    .filter((n) => matchesSearch(n, q, lang))
    .map((n) => ({
      ...n,
      children: n.children.filter((c) => matchesSearch(c, q, lang)),
    }));
}

function Node({
  node,
  selected,
  onSelect,
  depth,
  forceOpen,
  counts,
  lang,
}: {
  node: ICategoryTree;
  selected: string;
  onSelect: (s: string) => void;
  depth: number;
  forceOpen?: boolean;
  counts?: Record<string, number>;
  lang: string;
}) {
  const hasChildren = node.children.length > 0;
  const containsSelected = (n: ICategoryTree): boolean =>
    n.slug === selected || n.children.some(containsSelected);
  const [open, setOpen] = useState(() => containsSelected(node));

  const isOpen = forceOpen || open;
  const isSelected = selected === node.slug;

  const handleClick = () => {
    if (hasChildren) setOpen((o) => !o);
    onSelect(node.slug);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        data-slug={node.slug}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-left transition-colors
          ${isSelected ? "bg-ocean-100 text-ocean-700 font-semibold" : "text-gray-700 hover:bg-gray-100"}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          )
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="flex-1">{catName(node, lang)}</span>
        {counts && counts[node.slug] != null && counts[node.slug] > 0 && (
          <span className="text-[10px] text-gray-400 shrink-0 ml-1">{counts[node.slug]}</span>
        )}
      </button>
      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <Node
              key={child.id}
              node={child}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
              forceOpen={forceOpen}
              counts={counts}
              lang={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryTreeNav({ nodes, selected, onSelect, depth = 0, counts }: Props) {
  const [search, setSearch] = useState("");
  const { lang, t } = useLang();
  const q = search.trim().toLowerCase();

  const visible = useMemo(
    () => (q ? filterTree(nodes, q, lang) : nodes),
    [nodes, q, lang]
  );

  return (
    <div className="space-y-1.5">
      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder={t.searchCategories}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs pl-7 pr-6 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-ocean-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="space-y-0.5">
        {!q && (
          <button
            onClick={() => onSelect("")}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-left transition-colors
              ${!selected ? "bg-ocean-100 text-ocean-700 font-semibold" : "text-gray-700 hover:bg-gray-100"}
            `}
          >
            <span className="w-3.5 h-3.5 shrink-0" />
            {t.allListings}
          </button>
        )}
        {visible.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-2">{t.noListingsFound}</p>
        ) : (
          visible.map((node) => (
            <Node
              key={node.id}
              node={node}
              selected={selected}
              onSelect={onSelect}
              depth={depth}
              forceOpen={q ? true : undefined}
              counts={counts}
              lang={lang}
            />
          ))
        )}
      </div>
    </div>
  );
}
