import {Connection, ConnectionDefinition,} from "./models/interfaces.ts";
import axios from "axios";
import FormData from 'form-data';

export default class PicaClient {
  private secret: string;
  private connections: Connection[] = [];
  private connectionDefinitions: ConnectionDefinition[] = [];
  private baseUrl: string;

  constructor(secret: string, baseUrl = "https://api.picaos.com") {
    this.secret = secret;
    this.baseUrl = baseUrl;
  }

  private generateHeaders() {
    return {
      "Content-Type": "application/json",
      "x-pica-secret": this.secret,
    };
  }

  async initialize() {
    await Promise.all([
      this.initializeConnections(),
      this.initializeConnectionDefinitions(),
    ]);
  }

  private async initializeConnections() {
    try {
      await this.refreshConnections();
    } catch (error) {
      this.connections = [];
    }
  }

  private async initializeConnectionDefinitions() {
    try {
      const headers = this.generateHeaders();
      const url = `${this.baseUrl}/v1/public/connection-definitions?limit=500`;
      const response = await axios.get(url, { headers });
      this.connectionDefinitions = response.data?.rows || [];
    } catch (error) {
      console.error("Failed to initialize connection definitions:", error);
      this.connectionDefinitions = [];
    }
  }

  getConnections() {
    return this.connections;
  }

  getConnectionDefinitions() {
    return this.connectionDefinitions;
  }

  async refreshConnections() {
    try {
      const headers = this.generateHeaders();
      const url = `${this.baseUrl}/v1/vault/connections?limit=300`;
      const response = await axios.get(url, { headers });
      this.connections = response.data?.rows || [];
      return this.connections;
    } catch (error) {
      console.error("Failed to fetch connections:", error);
      return this.connections;
    }
  }

  async getAvailableActions(platform: string) {
    try {
      const headers = this.generateHeaders();
      const url = `${this.baseUrl}/v1/knowledge?supported=true&connectionPlatform=${platform}&limit=1000`;
      const response = await axios.get(url, { headers });
      return response.data?.rows || [];
    } catch (error) {
      console.error("Error fetching available actions:", error);
      throw new Error("Failed to fetch available actions");
    }
  }

  async getActionKnowledge(actionId: string) {
    try {
      const headers = this.generateHeaders();
      const url = `${this.baseUrl}/v1/knowledge?_id=${actionId}`;
      const response = await axios.get(url, { headers });

      if (!response.data.rows || response.data.rows.length === 0) {
        throw new Error(`Action with ID ${actionId} not found`);
      }

      return response.data.rows[0];
    } catch (error) {
      console.error("Error fetching action knowledge:", error);
      throw new Error("Failed to fetch action knowledge");
    }
  }

  public replacePathVariables(path: string, variables: Record<string, string | number | boolean>): string {
    return path.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = variables[variable];
      if (!value) {
        throw new Error(`Missing value for path variable: ${variable}`);
      }
      return value.toString();
    });
  }

  async executeAction(
    actionId: string,
    connectionKey: string,
    method: string,
    path: string,
    data?: any,
    pathVariables?: Record<string, string | number | boolean>,
    queryParams?: Record<string, any>,
    headers?: Record<string, any>,
    isFormData?: boolean,
    isFormUrlEncoded?: boolean
  ) {
    try {
      const newHeaders = {
        ...this.generateHeaders(),
        'x-pica-connection-key': connectionKey,
        'x-pica-action-id': actionId,
        ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : {}),
        ...(isFormUrlEncoded ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...headers
      };

      // Handle path variables
      let resolvedPath = path;
      if (pathVariables) {
        resolvedPath = this.replacePathVariables(path, pathVariables);
      }

      const url = `${this.baseUrl}/v1/passthrough${resolvedPath.startsWith('/') ? resolvedPath : '/' + resolvedPath}`;

      const requestConfig: any = {
        url,
        method,
        headers: newHeaders,
        params: queryParams
      };

      if (method?.toLowerCase() !== 'get') {
        if (isFormData) {
          const formData = new FormData();

          if (data && typeof data === 'object' && !Array.isArray(data)) {
            Object.entries(data).forEach(([key, value]) => {
              if (typeof value === 'object') {
                formData.append(key, JSON.stringify(value));
              } else {
                formData.append(key, value);
              }
            });
          }

          requestConfig.data = formData;
          Object.assign(requestConfig.headers, formData.getHeaders());
        } else if (isFormUrlEncoded) {
          const params = new URLSearchParams();

          if (data && typeof data === 'object' && !Array.isArray(data)) {
            Object.entries(data).forEach(([key, value]) => {
              if (typeof value === 'object') {
                params.append(key, JSON.stringify(value));
              } else {
                params.append(key, String(value));
              }
            });
          }

          requestConfig.data = params;
        } else {
          requestConfig.data = data;
        }
      }

      const response = await axios(requestConfig);
      return {
        responseData: response.data,
        requestConfig
      };
    } catch (error) {
      console.error("Error executing action:", error);
      throw error;
    }
  }
}
