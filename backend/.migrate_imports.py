import re, sys, os

# Rewrite relative-path string literals in a moved test file.
# depth = number of directories the new location is below `backend/`.
#   tests/  was depth 1  -> '../X' meant backend/X
#   modules/<d>/__tests__/ is depth 3
#   __tests__/integration/ is depth 2
# helpers stay in backend/tests/helpers/. From the new location the path to
# backend/tests/helpers/ is ('../' * depth) + 'tests/helpers/'.

def rewrite(path, depth):
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    up = '../' * depth  # reaches backend/ from new location
    helpers_prefix = up + 'tests/helpers/'

    # Match a quoted string literal that is a relative path reference.
    # Handles: '../x', '../../packages/x', './helpers/x', 'helpers/x'
    str_re = re.compile(r'''(['"])((?:\.\.?/|helpers/)[^'"]*)\1''')

    def repl(m):
        q, p = m.group(1), m.group(2)
        # helpers references -> point at backend/tests/helpers (which stays put)
        if p.startswith('./helpers/'):
            newp = helpers_prefix + p[len('./helpers/'):]
        elif p.startswith('helpers/'):
            newp = helpers_prefix + p[len('helpers/'):]
        elif p.startswith('../../packages/'):
            # was backend/tests -> '../../packages' = repo/packages.
            # repo/packages from new location = ('../'*(depth+1)) + 'packages/'
            newp = ('../' * (depth + 1)) + 'packages/' + p[len('../../packages/'):]
        elif p.startswith('../') and not p.startswith('../../'):
            # single '../X' from old tests/ reached backend/X.
            # From new location backend/X = up + X
            newp = up + p[len('../'):]
        elif p.startswith('../../'):
            # other deeper relative (rare) - treat the leading '../' (which
            # reached backend/) and keep the remainder structure: '../../Y'
            # from tests/ reached repo-root/Y? No: tests is depth1, '../../Y'
            # = repo-root/Y. From new loc repo-root/Y = ('../'*(depth+1))+Y
            newp = ('../' * (depth + 1)) + p[len('../../'):]
        else:
            return m.group(0)
        return q + newp + q

    new = str_re.sub(repl, src)
    if new != src:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        print(f"REWROTE {path}")
    else:
        print(f"NOCHANGE {path}")

if __name__ == '__main__':
    depth = int(sys.argv[1])
    for p in sys.argv[2:]:
        rewrite(p, depth)
