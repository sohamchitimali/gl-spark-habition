package com.gl.app.AuthService.service;

import com.gl.app.AuthService.dto.FriendshipDto;
import com.gl.app.AuthService.dto.ProfileDto;
import com.gl.app.AuthService.entity.Friendship;
import com.gl.app.AuthService.entity.FriendshipStatus;
import com.gl.app.AuthService.entity.User;
import com.gl.app.AuthService.repository.FriendshipRepository;
import com.gl.app.AuthService.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendshipService {

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    public FriendshipDto sendFriendRequest(Long requesterId, String addresseeUsername) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requester not found"));

        User addressee = userRepository.findByUsername(addresseeUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User to add not found"));

        if (requester.getId().equals(addressee.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add yourself");
        }

        Optional<Friendship> existing = friendshipRepository.findFriendshipBetween(requester, addressee);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Friendship or request already exists");
        }

        Friendship friendship = Friendship.builder()
                .requester(requester)
                .addressee(addressee)
                .status(FriendshipStatus.PENDING)
                .build();

        friendship = friendshipRepository.save(friendship);
        return mapToDto(friendship, requesterId);
    }

    public FriendshipDto acceptRequest(Long userId, Long friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship not found"));

        if (!friendship.getAddressee().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to accept this request");
        }

        if (friendship.getStatus() == FriendshipStatus.ACCEPTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Already accepted");
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendship = friendshipRepository.save(friendship);
        return mapToDto(friendship, userId);
    }

    public void removeOrRejectFriend(Long userId, Long friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship not found"));

        if (!friendship.getRequester().getId().equals(userId) && !friendship.getAddressee().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to modify this friendship");
        }

        friendshipRepository.delete(friendship);
    }

    public List<FriendshipDto> getUserFriendships(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return friendshipRepository.findAllByUser(user).stream()
                .map(f -> mapToDto(f, userId))
                .collect(Collectors.toList());
    }

    private FriendshipDto mapToDto(Friendship f, Long currentUserId) {
        User otherUser = f.getRequester().getId().equals(currentUserId) ? f.getAddressee() : f.getRequester();
        ProfileDto otherProfile = userService.getProfile(otherUser.getId());
        
        return new FriendshipDto(
                f.getId(),
                otherUser.getId(),
                otherProfile,
                f.getStatus(),
                f.getRequester().getId().equals(currentUserId),
                f.getCreatedAt()
        );
    }
}
