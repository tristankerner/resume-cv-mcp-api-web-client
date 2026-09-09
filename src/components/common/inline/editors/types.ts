export interface EditorProps<T> {
  value: T;
  onCommit: (value: T) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}
