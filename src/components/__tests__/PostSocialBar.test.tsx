import { render, screen, fireEvent } from '@testing-library/react-native'
import { Share } from 'react-native'
import { PostSocialBar } from '../PostSocialBar'

jest.mock('@/services/social', () => ({
  getFeedSocial: jest.fn().mockResolvedValue({
    w1: { likes: 2, likedByMe: false, comments: 1 },
  }),
  likePost: jest.fn().mockResolvedValue(undefined),
  unlikePost: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

const { likePost } = require('@/services/social')

describe('PostSocialBar', () => {
  it('visar räknare, gillar och delar', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
    render(
      <PostSocialBar
        postKey="w1"
        ownerId="u2"
        shareText="Löpning · 6,05 km — loggat med SeventyFive"
        onOpenComments={() => {}}
      />
    )
    expect(await screen.findByText('2 gillanden')).toBeOnTheScreen()
    expect(screen.getByText('1 kommentar')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('socialLike'))
    expect(likePost).toHaveBeenCalledWith('w1', 'u2')
    expect(screen.getByText('3 gillanden')).toBeOnTheScreen()   // optimistiskt +1

    fireEvent.press(screen.getByTestId('socialShare'))
    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Löpning · 6,05 km — loggat med SeventyFive',
    })
  })
})
