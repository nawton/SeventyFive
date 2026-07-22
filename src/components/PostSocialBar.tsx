import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { getFeedSocial, likePost, unlikePost } from '@/services/social'
import { CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, DIVIDER, CARD_BORDER } from '@/lib/theme'

// =============================================================================
// SOCIAL RAD — Strava-stil under passdetaljerna: "2 gillanden · 1
// kommentar" och knapparna gilla, kommentera och dela. Sköter sitt eget
// data (hämtar räknare, togglar optimistiskt); kommentarsknappen leder
// till inläggets diskussionssida via föräldern, dela öppnar systemets
// delningsark.
// =============================================================================

export function PostSocialBar({ postKey, ownerId, shareText, onOpenComments }: {
  postKey: string
  ownerId: string
  /** Texten som delas via systemarket */
  shareText: string
  /** Öppna diskussionssidan (föräldern stänger ev. modal först) */
  onOpenComments?: () => void
}) {
  const [likes, setLikes] = useState(0)
  const [likedByMe, setLikedByMe] = useState(false)
  const [comments, setComments] = useState(0)

  useEffect(() => {
    let alive = true
    getFeedSocial([postKey]).then(map => {
      if (!alive) return
      const entry = map[postKey]
      if (entry) {
        setLikes(entry.likes)
        setLikedByMe(entry.likedByMe)
        setComments(entry.comments)
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [postKey])

  function toggleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const next = !likedByMe
    setLikedByMe(next)
    setLikes(n => Math.max(0, n + (next ? 1 : -1)))
    ;(next ? likePost(postKey, ownerId) : unlikePost(postKey)).catch(() => {
      setLikedByMe(!next)
      setLikes(n => Math.max(0, n + (next ? -1 : 1)))
    })
  }

  function handleShare() {
    Share.share({ message: shareText }).catch(() => {})
  }

  return (
    <View style={s.wrap}>
      <View style={s.countsRow}>
        <Text style={s.countText}>
          {likes === 1 ? '1 gillande' : `${likes} gillanden`}
        </Text>
        <Text style={s.countText}>
          {comments === 1 ? '1 kommentar' : `${comments} kommentarer`}
        </Text>
      </View>
      <View style={s.buttonsRow}>
        <TouchableOpacity style={s.actionBtn} onPress={toggleLike} testID="socialLike">
          <Ionicons
            name={likedByMe ? 'heart' : 'heart-outline'}
            size={24}
            color={likedByMe ? '#FF3B4A' : TEXT_PRIMARY}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={onOpenComments}
          disabled={!onOpenComments}
          testID="socialComment"
        >
          <Ionicons
            name="chatbubble-outline"
            size={23}
            color={onOpenComments ? TEXT_PRIMARY : TEXT_SECONDARY}
          />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleShare} testID="socialShare">
          <Ionicons name="share-outline" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: CARD_BORDER,
    marginTop: 12,
  },
  countsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  countText: { color: TEXT_SECONDARY, fontSize: 13 },
  buttonsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
  },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
})
