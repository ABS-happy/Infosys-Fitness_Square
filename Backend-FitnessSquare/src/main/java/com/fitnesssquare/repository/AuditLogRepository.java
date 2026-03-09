package com.fitnesssquare.repository;

import com.fitnesssquare.model.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {
    List<AuditLog> findByTargetId(String targetId);

    List<AuditLog> findByActionType(String actionType);
}
