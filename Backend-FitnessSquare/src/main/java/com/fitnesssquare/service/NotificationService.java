package com.fitnesssquare.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fitnesssquare.model.Notification;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.NotificationRepository;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    public void createNotification(User recipient, String message, String type, String relatedEntityId) {
        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setMessage(message);
        notification.setType(type);
        notification.setRelatedEntityId(relatedEntityId);
        notification.setCreatedAt(LocalDateTime.now());
        notification.setRead(false);
        notificationRepository.save(notification);
    }

    public List<Notification> getUserNotifications(User user) {
        return notificationRepository.findByRecipientOrderByCreatedAtDesc(user);
    }

    public List<Notification> getUnreadNotifications(User user) {
        return notificationRepository.findByRecipientAndIsReadFalse(user);
    }

    public void markAsRead(String notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            notification.setRead(true);
            notificationRepository.save(notification);
        });
    }

    public void markAllAsRead(User user) {
        List<Notification> unread = notificationRepository.findByRecipientAndIsReadFalse(user);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    public void deleteNotification(String notificationId) {
        notificationRepository.deleteById(notificationId);
    }
}
