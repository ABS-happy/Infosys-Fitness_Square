package com.fitnesssquare.repository;

import com.fitnesssquare.model.Comment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface CommentRepository extends MongoRepository<Comment, String> {
    List<Comment> findByPostIdOrderByCreatedAtAsc(String postId);
}
