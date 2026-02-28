import { Injectable, inject } from '@angular/core';
import {
  FirebaseFirestore,
  QueryCompositeFilterConstraint,
  QueryNonFilterConstraint,
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
    //const reference = this.tenantService.getCollectionPath(collection);
    const reference = 'devices'

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
}
