package com.fitnesssquare.repository;

import org.springframework.data.mongodb.repository.Query;
import com.fitnesssquare.model.BlogPost;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface BlogRepository extends MongoRepository<BlogPost, String> {
    List<BlogPost> findByStatusOrderByCreatedAtDesc(String status);

    @Query(value = "{ 'status' : ?0, 'archived' : { $ne : true } }", sort = "{ 'createdAt' : -1 }")
    List<BlogPost> findByStatusAndArchivedFalseOrderByCreatedAtDesc(String status);

    List<BlogPost> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    List<BlogPost> findByAuthorId(String authorId);

    List<BlogPost> findByAuthorIdAndArchivedTrueOrderByCreatedAtDesc(String authorId);

    @Query(value = "{ 'authorId' : ?0, 'archived' : { $ne : true } }", sort = "{ 'createdAt' : -1 }")
    List<BlogPost> findByAuthorIdAndArchivedFalseOrderByCreatedAtDesc(String authorId);

    List<BlogPost> findByStatus(String status);
}
