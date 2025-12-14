export interface AvailableAction {
  _id: string;
  title: string;
  tags?: string[];
  knowledge?: any;
  path?: string;
}

export interface Connection {
  key: string;
  platform: string;
  active: boolean;
}

export interface ConnectionDefinition {
  platform: string;
  frontend: {
    spec: {
      title: string;
    };
  };
}
