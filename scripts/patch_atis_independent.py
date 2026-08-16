from pathlib import Path

path = Path("src/pages/AdminPanel.tsx")
text = path.read_text()

required = [
    'import AdminAtis from "@/components/admin/atis/AdminAtis";\n',
    ' | "harpa-reports" | "atis";',
    '      { id: "atis", label: "ATIS WhatsApp", desc: "Mensagens e automações", icon: MessageCircle },\n',
    '      case "atis": return <AdminAtis />;\n',
    '      <div className="pt-2 grid grid-cols-2 gap-3">\n',
    '  const DesktopHome = ({ openTool }: { openTool: (id: string) => void }) => (\n',
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"AdminPanel structure changed; missing {missing!r}")

text = text.replace('import AdminAtis from "@/components/admin/atis/AdminAtis";\n', "")
text = text.replace(' | "harpa-reports" | "atis";', ' | "harpa-reports";')
text = text.replace('      { id: "atis", label: "ATIS WhatsApp", desc: "Mensagens e automações", icon: MessageCircle },\n', "")
text = text.replace('      case "atis": return <AdminAtis />;\n', "")

mobile_shortcut = '''      <div className="pt-2 space-y-2">
        <p className="px-1 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--dark-muted))]">Painel independente</p>
        <button
          onClick={() => navigate("/atis")}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] active:scale-[0.99] border border-primary/15"
        >
          <span className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-primary/15 text-primary">
            <MessageCircle className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[hsl(var(--dark-text))] truncate">ATIS WhatsApp</p>
            <p className="text-xs text-[hsl(var(--dark-muted))] truncate">Abrir central de mensagens e automações</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[hsl(var(--dark-muted))] shrink-0" />
        </button>
      </div>

'''
text = text.replace(
    '      <div className="pt-2 grid grid-cols-2 gap-3">\n',
    mobile_shortcut + '      <div className="pt-2 grid grid-cols-2 gap-3">\n',
    1,
)

desktop_marker = '  const DesktopHome = ({ openTool }: { openTool: (id: string) => void }) => (\n'
before, after = text.split(desktop_marker, 1)
desktop_target = '      {getVisibleSections(isSuperAdmin).map((section) => {\n'
if desktop_target not in after:
    raise SystemExit("Desktop admin home structure changed")

desktop_shortcut = '''      <button
        onClick={() => navigate("/atis")}
        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] transition-colors border border-primary/15"
      >
        <span className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-primary/15 text-primary">
          <MessageCircle className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--dark-muted))]">Painel independente</p>
          <p className="text-base font-bold text-[hsl(var(--dark-text))]">ATIS WhatsApp</p>
          <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">Mensagens, contatos, grupos e automações fora das categorias do Admin.</p>
        </div>
        <ChevronRight className="w-5 h-5 text-[hsl(var(--dark-muted))] shrink-0" />
      </button>

'''
after = after.replace(desktop_target, desktop_shortcut + desktop_target, 1)
text = before + desktop_marker + after

path.write_text(text)
