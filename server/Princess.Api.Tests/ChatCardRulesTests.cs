using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 3: typed cards and places, pins and mentions.</summary>
public class ChatCardRulesTests
{
    [Fact]
    public void ACardCarriesOnlyNamesTimesAndPlacesNeverMoneyOrIdentity()
    {
        var json = ChatCardRules.Serialise(new ChatCard(ChatCardRules.Excursion, "Reef snorkel by boat", "Cozumel", 3, "08:30", "Meet on the pier", ChatCardRules.PathOf(ChatCardRules.Excursion)));
        Assert.False(ChatCardRules.HasForbiddenKey(json));
        foreach (var key in new[] { "price", "totalCents", "folio", "cabin", "cabinNumber", "bookingNumber", "email", "phone", "card", "payment", "dob" })
            Assert.True(ChatCardRules.HasForbiddenKey($"{{\"title\":\"x\",\"{key}\":\"1\"}}"), key);
        Assert.True(ChatCardRules.HasForbiddenKey("not json"));
    }

    [Fact]
    public void EveryFieldOfTheCardRecordIsOnTheAllowedList()
    {
        // If someone adds a property that names money or identity to the card, this fails before it can ship.
        foreach (var p in typeof(ChatCard).GetProperties()) Assert.DoesNotContain(p.Name.ToLowerInvariant(), ChatCardRules.ForbiddenKeys);
    }

    [Fact]
    public void ThePayloadRoundTripsAndOmitsWhatIsEmpty()
    {
        var card = new ChatCard(ChatCardRules.Dining, "Crown Grill", "Steakhouse", 2, "19:00", "Deck 7 aft", "/plan/dining");
        Assert.Equal(card, ChatCardRules.Parse(ChatCardRules.Serialise(card)));
        Assert.DoesNotContain("expiresAt", ChatCardRules.Serialise(card));
        Assert.Null(ChatCardRules.Parse(null));
        Assert.Null(ChatCardRules.Parse("{bad"));
    }

    [Fact]
    public void APlaceCardExpiresSixHoursAfterItWasSentAndNotBefore()
    {
        var sent = new DateTime(2027, 3, 22, 16, 0, 0, DateTimeKind.Utc);
        var card = ChatShareService.Place(ShipPlaceId(), "  by the\r\nfountain ", sent);
        var expiry = Shipboard.Ms(sent.AddHours(6));
        Assert.Equal(expiry, card.ExpiresAt);
        Assert.False(ChatCardRules.IsExpired(card.ExpiresAt, expiry - 1));
        Assert.True(ChatCardRules.IsExpired(card.ExpiresAt, expiry));
        Assert.Equal("by the fountain", card.Note);
        Assert.False(ChatCardRules.IsExpired(null, long.MaxValue));   // a card with no expiry never goes stale by time
    }

    [Fact]
    public void ACardIsGoneOnceItsExcursionOrDinnerIsNoLongerBooked()
    {
        var tour = Guid.NewGuid();
        var kept = new ChatCard(ChatCardRules.Excursion, "Reef", Ref: tour);
        Assert.False(ChatCardRules.IsGone(kept, new HashSet<Guid> { tour }));
        Assert.True(ChatCardRules.IsGone(kept, new HashSet<Guid>()));
        Assert.False(ChatCardRules.IsGone(new ChatCard(ChatCardRules.PortDay, "Cozumel"), new HashSet<Guid>()));   // no source to cancel
        Assert.Equal([tour], ChatCardRules.SourceIds([kept, kept, null, new ChatCard(ChatCardRules.Booking, "Trip", Ref: Guid.NewGuid())]));
    }

    [Fact]
    public void APlaceMustBeNamedByTheShipProfile()
    {
        var e = Assert.Throws<ApiException>(() => ChatShareService.Place("the-secret-bar", null, DateTime.UtcNow));
        Assert.Equal("place", e.Message);
    }

    [Fact]
    public void ANoteIsOneShortLine()
    {
        Assert.Null(ChatCardRules.CleanNote("   "));
        Assert.Equal(ChatCardRules.MaxNote, ChatCardRules.CleanNote(new string('a', 300))!.Length);
    }

    [Fact]
    public void OnlyThreePinsFitAndRepinningIsFine()
    {
        Assert.True(ChatCardRules.CanAddPin(0));
        Assert.True(ChatCardRules.CanAddPin(2));
        Assert.False(ChatCardRules.CanAddPin(3));
    }

    [Fact]
    public void WhoMayPin()
    {
        Assert.True(ChatCardRules.MayPin("direct", false));
        Assert.True(ChatCardRules.MayPin("party", false));
        Assert.True(ChatCardRules.MayPin("group", true));
        Assert.False(ChatCardRules.MayPin("group", false));
        Assert.False(ChatCardRules.MayPin("stanley", true));
    }

    [Fact]
    public void MentionsKeepActiveMembersOnceNeverTheSenderAndAtMostTen()
    {
        var members = Enumerable.Range(1, 14).ToDictionary(_ => Guid.NewGuid(), i => (long)i + 100);
        var ids = members.Keys.ToList();
        var sender = members[ids[0]];
        var named = new List<Guid> { ids[0], ids[1], ids[1], Guid.NewGuid() };   // the sender, a repeat and a stranger
        Assert.Equal([members[ids[1]]], ChatCardRules.ValidMentions(named, members, sender));
        Assert.Equal(ChatCardRules.MaxMentions, ChatCardRules.ValidMentions(ids, members, 0).Count);
        Assert.Empty(ChatCardRules.ValidMentions(null, members, sender));
    }

    [Fact]
    public void AMentionBreaksThroughAMuteAndMentionsOnlyButOtherMessagesDoNot()
    {
        Assert.True(ChatCardRules.AlertsRecipient(muted: false, mentionsOnly: false, mentioned: false));
        Assert.False(ChatCardRules.AlertsRecipient(muted: true, mentionsOnly: false, mentioned: false));
        Assert.True(ChatCardRules.AlertsRecipient(muted: true, mentionsOnly: false, mentioned: true));
        Assert.False(ChatCardRules.AlertsRecipient(muted: false, mentionsOnly: true, mentioned: false));
        Assert.True(ChatCardRules.AlertsRecipient(muted: false, mentionsOnly: true, mentioned: true));
    }

    [Fact]
    public void AMentionNoticeSaysSoAndStillCarriesNoTextUnlessThePreviewIsOn()
    {
        var plain = ChatConversationRules.MessageNotice("Sam R.", "lunch at 1?", showPreview: false, mentioned: true);
        Assert.Equal("Sam R. mentioned you", plain.Title.Trim());
        Assert.DoesNotContain("lunch", plain.Body);
        Assert.StartsWith("lunch", ChatConversationRules.MessageNotice("Sam R.", "lunch at 1?", showPreview: true, mentioned: true).Body);
    }

    [Fact]
    public void StanleyIsCalledByHisHandle()
    {
        Assert.True(ChatCardRules.MentionsStanley("hey @stanley what time is it"));
        Assert.False(ChatCardRules.MentionsStanley("stanley said so"));
    }

    [Fact]
    public void ATypedMessageHasAWordedPreviewForTheListAndAlerts()
    {
        Assert.Equal("Meet me at Piazza", ChatCardRules.Preview(ChatCardRules.Place, new ChatCard(ChatCardRules.PlaceType, "Piazza")));
        Assert.Equal("Crown Grill", ChatCardRules.Preview(ChatCardRules.Card, new ChatCard(ChatCardRules.Dining, "Crown Grill")));
        Assert.True(ChatCardRules.IsTyped("card"));
        Assert.False(ChatCardRules.IsTyped("text"));
        Assert.False(ChatCardRules.IsTyped(null));
    }

    private static string ShipPlaceId() => ShipReference.Get().Places[0].Id;
}
