

## Problema
O versículo do dia fica sempre o mesmo (João 3:16) porque o cache no `localStorage` (`daily-verse-cache`) guarda a data e o versículo. Uma vez que o versículo foi salvo com a data de hoje, ele nunca mais busca um novo — e se o cache ficou "preso" com um valor antigo (ou foi gravado pela primeira vez com o fallback), ele continua retornando sempre o mesmo.

Além disso, o `getDailyVerse()` usado como fallback inicial (linha 44-45 do HomePage) é executado **antes** do `useEffect`, e se o `getRandomVerse()` falhar (ex: Bible JSON não carregou), o fallback fica como estado final.

## Causa raiz
1. **Cache stale**: Se o usuário abriu o app pela primeira vez quando `dayOfYear % 30 = 0`, o versículo João 3:16 foi gravado. A partir daí, toda vez que abre no mesmo dia, retorna do cache.
2. **Fallback silencioso**: O `getRandomVerse` pode falhar ao carregar o JSON da Bíblia. O `.catch(() => {})` engole o erro, e o estado fica com o fallback (`getDailyVerse()`).
3. **Mesmo cálculo, mesmo resultado**: Tanto `getDailyVerse` quanto `getRandomVerse` usam `dayOfYear % length` — se ambos têm o mesmo tamanho de array (30), o índice é o mesmo todo dia.

## Plano de correção

### 1. Limpar cache quando a data muda
No `useEffect`, se o cache existe mas a data é diferente de hoje, **remover o cache** antes de buscar o novo versículo. Isso garante que não fica preso em um valor antigo.

### 2. Melhorar o fallback inicial
Em vez de usar `getDailyVerse()` como estado inicial (que mostra João 3:16 antes do fetch), iniciar com `null` e mostrar o loading skeleton até o fetch terminar.

### 3. Garantir que getRandomVerse funcione
Adicionar log no catch e garantir que o fallback do `getRandomVerse` (o `getDailyVerse`) realmente retorne o versículo correto do dia, não sempre o índice 0.

### 4. Forçar invalidação de cache ao trocar de dia
No `useEffect`, comparar `cached?.date !== today` e se for diferente, ignorar o cache e buscar novo.

### Arquivos a editar
- **`src/pages/HomePage.tsx`**: Ajustar lógica de cache do versículo diário — iniciar com `null`, invalidar cache de dia anterior, melhorar tratamento de erro
- **`src/data/bible.ts`**: Verificar se `getDailyVerse` retorna o cálculo correto (a lógica parece correta, mas vamos validar)

### Segurança
Scan realizado ✅ — mesmos findings anteriores (perfis públicos, push anônimo, leaked password). Nenhum novo problema.

