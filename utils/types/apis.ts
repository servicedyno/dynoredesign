export interface ApiKeyCardProps {
  title: string;
  apiRow?: any;
  onCopy: (value: string) => void;
  onDelete: (apiId: number) => void;
}

export interface ApiKeysPageProps {
  openCreate?: boolean;
  setOpenCreate?: (open: boolean) => void;
}
