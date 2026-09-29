import { Directory, File, Paths } from "expo-file-system";

export function createStorageId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Paths.document 아래 루트 하나를 기준으로 "sub/dir/name" 형태의 저장 경로를 다룬다.
// DB에는 이 상대 경로만 저장해 앱 컨테이너 경로가 바뀌어도 파일을 찾을 수 있게 한다.
export function createManagedDirectory(rootName: string) {
  const root = () => new Directory(Paths.document, rootName);

  const directory = (relativePath: string) =>
    relativePath
      .split("/")
      .reduce((parent, segment) => new Directory(parent, segment), root());

  const file = (storedPath: string) => {
    const segments = storedPath.split("/");
    const name = segments.pop()!;
    return new File(
      segments.length > 0 ? directory(segments.join("/")) : root(),
      name,
    );
  };

  return {
    directory,
    file,
    ensure(...relativePaths: string[]) {
      root().create({ idempotent: true, intermediates: true });
      for (const relativePath of relativePaths) {
        directory(relativePath).create({
          idempotent: true,
          intermediates: true,
        });
      }
    },
    remove(storedPath: string | null | undefined) {
      if (!storedPath) return;

      try {
        const target = file(storedPath);
        if (target.exists) target.delete();
      } catch {
        // DB state is the source of truth; missing file cleanup can be ignored.
      }
    },
  };
}

export type ManagedDirectory = ReturnType<typeof createManagedDirectory>;
