import { Injectable, inject } from '@angular/core';
import {
  FirebaseFirestore,
  QueryCompositeFilterConstraint,
  QueryNonFilterConstraint,
  WriteBatchOperation,
} from '@capacitor-firebase/firestore';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';

export interface CollectionQueryResult<T> {
  documents: { id: string; path: string; data: T }[];
  lastDocumentPath: string | null;
}

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private logger = inject(LoggerService);
  private tenantService = inject(TenantService);

  async getDocument<T = Record<string, unknown>>(reference: string): Promise<T | null> {
    this.logger.debug('Firestore getDocument', { reference });
    const result = await FirebaseFirestore.getDocument({ reference });
    return (result.snapshot?.data as T) ?? null;
  }

  async getTenantDocument<T = Record<string, unknown>>(
    collection: string,
    docId: string,
  ): Promise<T | null> {
    const reference = `${this.tenantService.getCollectionPath(collection)}/${docId}`;
    return this.getDocument<T>(reference);
  }

  async queryTenantCollection<T = Record<string, unknown>>(
    collection: string,
    options: {
      compositeFilter?: QueryCompositeFilterConstraint;
      queryConstraints?: QueryNonFilterConstraint[];
    },
  ): Promise<CollectionQueryResult<T>> {
    const reference = this.tenantService.getCollectionPath(collection);

    this.logger.debug('Firestore queryTenantCollection', { reference });

    const result = await FirebaseFirestore.getCollection({
      reference,
      compositeFilter: options.compositeFilter,
      queryConstraints: options.queryConstraints,
    });

    const documents = (result.snapshots ?? []).map((snapshot) => ({
      id: snapshot.id,
      path: snapshot.path,
      data: snapshot.data as T,
    }));

    const lastDocumentPath = documents.length > 0
      ? documents[documents.length - 1].path
      : null;

    return { documents, lastDocumentPath };
  }

  async setDocument(reference: string, data: Record<string, unknown>): Promise<void> {
    this.logger.debug('Firestore setDocument', { reference });
    await FirebaseFirestore.setDocument({ reference, data });
  }

  async setTenantDocument(
    collection: string,
    docId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const reference = `${this.tenantService.getCollectionPath(collection)}/${docId}`;
    await this.setDocument(reference, data);
  }

  async addTenantDocument(
    collection: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const reference = this.tenantService.getCollectionPath(collection);
    this.logger.debug('Firestore addTenantDocument', { reference });
    const result = await FirebaseFirestore.addDocument({ reference, data });
    return result.reference.id;
  }

  async queryTenantSubcollection<T = Record<string, unknown>>(
    parentDocReference: string,
    subcollection: string,
  ): Promise<CollectionQueryResult<T>> {
    const tenantPath = this.tenantService.getTenantDocPath();
    return this.querySubcollection<T>(`${tenantPath}/${parentDocReference}`, subcollection);
  }

  async querySubcollection<T = Record<string, unknown>>(
    parentDocReference: string,
    subcollection: string,
  ): Promise<CollectionQueryResult<T>> {
    const reference = `${parentDocReference}/${subcollection}`;

    this.logger.debug('Firestore querySubcollection', { reference });

    const result = await FirebaseFirestore.getCollection({ reference });

    const documents = (result.snapshots ?? []).map((snapshot) => ({
      id: snapshot.id,
      path: snapshot.path,
      data: snapshot.data as T,
    }));

    return { documents, lastDocumentPath: null };
  }

  /**
   * Executes multiple write operations as a single atomic batch.
   * All operations succeed or all fail. Combined with Firestore rules
   * (allow update: if false), set operations on existing documents
   * will cause the entire batch to fail - preventing overwrites.
   */
  async writeBatch(operations: WriteBatchOperation[]): Promise<void> {
    this.logger.debug('Firestore writeBatch', { operationCount: operations.length });
    await FirebaseFirestore.writeBatch({ operations });
  }

  /**
   * Builds a full Firestore reference path for a tenant-scoped document.
   */
  buildTenantReference(collection: string, docId: string): string {
    return `${this.tenantService.getCollectionPath(collection)}/${docId}`;
  }

  /**
   * Generates a random 20-character document ID.
   * Uses the same algorithm as Firebase's AutoId.newId() -
   * crypto-secure random bytes mapped to alphanumeric characters.
   */
  generateId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const maxMultiple = Math.floor(256 / chars.length) * chars.length;
    let autoId = '';
    const targetLength = 20;
    while (autoId.length < targetLength) {
      const bytes = crypto.getRandomValues(new Uint8Array(40));
      for (let i = 0; i < bytes.length; ++i) {
        if (autoId.length < targetLength && bytes[i] < maxMultiple) {
          autoId += chars.charAt(bytes[i] % chars.length);
        }
      }
    }
    return autoId;
  }
}
