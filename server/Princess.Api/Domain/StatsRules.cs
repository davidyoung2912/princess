using System.Globalization;
using Princess.Api.Contracts;
using Princess.Api.Data;

namespace Princess.Api.Domain;

/// <summary>
/// The stats page (docs/stats-plan.md): turns what the database and the app's own counters hold into sections of real stats, each followed by a
/// few made-up ones, then a few sections that are nothing but made-up. Pure: the same inputs give the same report, so a guest who shares a
/// stat is looking at what the next person sees. A made-up stat is flagged <c>Joke</c> so the screen labels it; its number is worked out from
/// the guest's id and a real stat, so it stays put between visits (the fortune section also changes each day).
/// </summary>
public static class StatsRules
{
    private static readonly CultureInfo En = CultureInfo.GetCultureInfo("en-US");

    public static StatsReport Build(StatsRaw r, string name, Guid seedId, DateTime now)
    {
        var createdAt = r.Date("created_at") ?? now;
        var today = DateOnly.FromDateTime(now);
        var seed = Seed(seedId);
        var sections = new List<StatSection>
        {
            App(r, createdAt, now, today, seed),
            SignIns(r, createdAt, now, seed),
            Chat(r, seed),
            Stanley(r, seed),
            Dining(r, seed),
            Shows(r, seed),
            Ashore(r, seed),
            Spa(r, seed),
            Spending(r, seed),
            Voyages(r, now, seed),
            Ready(r, seed),
            Ship(r, seed),
            Social(r, seed),
            Records(r, today),
            Buffet(r, seed),
            Seagulls(seed),
            Privately(r, seed),
            Cabin(r, seed),
            Fortune(today, seed),
            Towel(seed),
        };
        var all = sections.SelectMany(s => s.Stats).ToList();
        var real = all.Count(s => !s.Joke);
        var pick = new[] { "app.active", "app.time", "chat.msgs", "dining.venues", "ashore.tours", "voyages.nights", "records.badges", "buffet.kcal", "privately.nick" };
        var ids = all.Select(s => s.Id).ToHashSet();
        var headline = $"{Num(Active(r))} days in the app, {Num(r.Get("msgs"))} chat messages, {Num(r.Get("dinners") + r.Get("shows") + r.Get("tours") + r.Get("spa"))} things booked and counting.";
        return new StatsReport(new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), name, headline, real, all.Count - real, pick.Where(ids.Contains).ToList(), sections);
    }

    // ---- real sections, each ending in a few made-up stats -------------------------------------------------------------------------

    private static StatSection App(StatsRaw r, DateTime createdAt, DateTime now, DateOnly today, uint seed)
    {
        var opens = Math.Max(r.Counter("opens"), r.Days.Sum(d => (long)d.Opens));
        var seconds = r.Counter("seconds");
        var views = r.Counter("views");
        var routes = r.Counters.Where(c => c.Key.StartsWith("route.", StringComparison.Ordinal) && c.Value > 0).OrderByDescending(c => c.Value).ThenBy(c => c.Key, StringComparer.Ordinal).ToList();
        var areas = r.Counters.Where(c => c.Key.StartsWith("area.", StringComparison.Ordinal) && c.Value > 0 && c.Key != "area.other").OrderByDescending(c => c.Value).ThenBy(c => c.Key, StringComparer.Ordinal).ToList();
        var since = Math.Max(1, (int)(now.Date - createdAt.Date).TotalDays + 1);
        var (current, longest) = Streaks(r.Days, today);
        var longestDay = r.Days.Count == 0 ? 0 : r.Days.Max(d => d.Seconds);
        var night = Hours(r, 0, 4);
        var morning = Hours(r, 5, 8);
        var items = new List<StatItem>
        {
            S("app.opens", "Times you opened the app", Num(opens)),
            S("app.time", "Time in the app", Dur(seconds), seconds > 0 ? $"About {Num(seconds / 3600)} full hours" : null),
            S("app.avg", "Average visit", opens > 0 ? Dur(seconds / opens) : "Not yet"),
            S("app.longestDay", "Longest day in the app", Dur(longestDay)),
            S("app.active", "Days you used the app", Num(Active(r)), $"Out of {Num(since)} since you joined"),
            S("app.share", "Share of days you showed up", $"{(Active(r) * 100 / since).ToString(En)}%"),
            S("app.streak", "Current streak", Days(current), current > 0 ? "Keep it going" : "Open the app tomorrow to start one"),
            S("app.bestStreak", "Longest streak", Days(longest)),
            S("app.views", "Screens viewed", Num(views)),
            S("app.screens", "Different screens visited", Num(routes.Count)),
        };
        if (routes.Count > 0) items.Add(S("app.fav", "Favourite screen", "", $"Visited {Num(routes[0].Value)} times", RoutePath(routes[0].Key)));
        if (areas.Count > 0) items.Add(S("app.area", "Favourite part of the app", AreaName(areas[0].Key), $"{Num(areas[0].Value)} screens"));
        var peak = Peak(r);
        if (peak >= 0) items.Add(S("app.peak", "Your busiest hour", HourName(peak), "On your device's clock"));
        if (Weekday(r.Days) is { } wd) items.Add(S("app.weekday", "Your busiest day of the week", wd));
        items.Add(S("app.night", "Minutes in the app after midnight", Num(night / 60), night >= 600 ? "A true night owl" : null));
        items.Add(S("app.morning", "Minutes in the app before 9 am", Num(morning / 60)));
        items.Add(S("app.member", "Member since", createdAt.ToString("MMMM d, yyyy", En), $"{Days(since)} ago"));
        items.Add(S("app.shares", "Times you shared a stat", Num(r.Counter("shares"))));
        items.Add(J("app.thumb", "Thumb distance travelled", $"{(views * 0.9 / 100 + Roll(seed, "thumb", 1, 9) / 10.0).ToString("N1", En)} metres", "Roughly a very short sprint"));
        items.Add(J("app.battery", "Battery sacrificed to the app", $"{(seconds / 60 * 3 / 10 + Roll(seed, "battery", 2, 14)).ToString(En)}%", "Given cheerfully"));
        items.Add(J("app.guilt", "Screen-time guilt level", Pick(seed, "guilt", "Mild", "Moderate", "Cruise-appropriate", "Concerning but charming")));
        return Sec("app", "Life in the app", "How often you drop in, for how long, and where you go.", "📱", items);
    }

    private static StatSection SignIns(StatsRaw r, DateTime createdAt, DateTime now, uint seed)
    {
        var first = r.Date("first_login_at") ?? createdAt;
        var items = new List<StatItem>
        {
            S("signins.logins", "Times you signed in", Num(r.Get("logins"))),
            S("signins.first", "First sign-in", first.ToString("MMMM d, yyyy", En), $"{Days(Math.Max(0, (int)(now.Date - first.Date).TotalDays))} ago"),
            S("signins.fails", "Sign-in slips", Num(r.Get("login_fails")), r.Get("login_fails") == 0 ? "A clean sheet" : "Everyone fat-fingers a password"),
            S("signins.devices", "Devices you have signed in on", Num(r.Get("devices"))),
            S("signins.browsers", "Different browsers or apps", Num(r.Get("browsers"))),
            S("signins.changes", "Things you have saved or changed", Num(r.Get("changes"))),
            S("signins.bumps", "Times the app said no", Num(r.Get("bumps")), "Blocked, not found or an error"),
            S("signins.edits", "Edits to your profile and details", Num(r.Get("profile_edits"))),
            J("signins.password", "Passwords you nearly typed in the username box", Num(Roll(seed, "password", 0, 4))),
            J("signins.remember", "Things you meant to remember today", Num(Roll(seed, "remember", 3, 11)), "Stanley remembers, so you do not have to"),
        };
        return Sec("signins", "Sign-ins and security", "Your doors into the app and how you use them.", "🔑", items);
    }

    private static StatSection Chat(StatsRaw r, uint seed)
    {
        var msgs = r.Get("msgs");
        var items = new List<StatItem>
        {
            S("chat.msgs", "Messages sent", Num(msgs)),
            S("chat.words", "Words written", Num(r.Get("words")), r.Get("words") > 0 ? $"About {Num(Math.Max(1, r.Get("words") / 250))} pages of a novel" : null),
            S("chat.chars", "Characters typed", Num(r.Get("chars"))),
            S("chat.avg", "Average message length", msgs > 0 ? $"{Num(r.Get("chars") / msgs)} characters" : "Not yet"),
            S("chat.longest", "Longest message", $"{Num(r.Get("longest_msg"))} characters"),
            S("chat.questions", "Questions asked", Num(r.Get("questions"))),
            S("chat.bangs", "Messages with an exclamation mark", Num(r.Get("bangs")), r.Get("bangs") > msgs / 3 && msgs > 5 ? "Very enthusiastic" : null),
            S("chat.laughs", "Messages that made you laugh out loud", Num(r.Get("laughs")), "Counting haha and lol"),
            S("chat.thanks", "Thank-yous said", Num(r.Get("thanks_said"))),
            S("chat.photos", "Photos sent", Num(r.Get("chat_photos"))),
            S("chat.days", "Days you chatted", Num(r.Get("chat_days"))),
            S("chat.groups", "Chats you are in", Num(r.Get("groups"))),
            S("chat.connections", "Friends you connected with", Num(r.Get("connections"))),
            S("chat.given", "Reactions you gave", Num(r.Get("reacts_given"))),
            S("chat.got", "Reactions you received", Num(r.Get("reacts_got"))),
            S("chat.mentions", "Times someone mentioned you", Num(r.Get("mentions"))),
            S("chat.pinned", "Your messages that were pinned", Num(r.Get("pinned"))),
        };
        if (r.Text("emoji") is { Length: > 0 } e) items.Add(S("chat.emoji", "Your favourite reaction", e));
        if (r.Text("room") is { Length: > 0 } room) items.Add(S("chat.room", "Your chattiest chat", room));
        items.Add(J("chat.typing", "Time spent typing, deleting and retyping", $"{Num(Math.Max(2, msgs * 7 / 60) + Roll(seed, "typing", 1, 9))} minutes", "Mostly deleting"));
        items.Add(J("chat.emojis", "Emojis you considered, then did not send", Num(msgs * 2 + Roll(seed, "emojis", 5, 40))));
        items.Add(J("chat.replies", "Replies you drafted in your head in the shower", Num(Roll(seed, "shower", 4, 31))));
        return Sec("chat", "Chat", "What you say, who you say it to, and how it lands.", "💬", items);
    }

    private static StatSection Stanley(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("stanley.asks", "Questions you asked Stanley", Num(r.Get("asks"))),
            S("stanley.actions", "Things Stanley did for you", Num(r.Get("stanley_actions"))),
            S("stanley.reminders", "Reminders you set", Num(r.Get("reminders"))),
            J("stanley.patience", "Stanley's patience used up", $"{Roll(seed, "patience", 1, 9)}%", "He says he has plenty left"),
            J("stanley.hours", "Hours Stanley has spent thinking about you", $"{(r.Get("asks") * 3 / 10 + Roll(seed, "hours", 2, 40)).ToString(En)}", "Not really, he is an app"),
        };
        return Sec("stanley", "Stanley", "Your helper, by the numbers.", "🤖", items);
    }

    private static StatSection Dining(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("dining.dinners", "Dinner reservations", Num(r.Get("dinners"))),
            S("dining.venues", "Different restaurants tried", Num(r.Get("venues"))),
            S("dining.specialty", "Specialty dinners", Num(r.Get("specialty"))),
            S("dining.cover", "Spent on dinner cover charges", Money(r.Get("cover_cents"))),
            S("dining.orders", "Orders placed", Num(r.Get("orders"))),
            S("dining.room", "Room service and breakfast orders", Num(r.Get("room_orders"))),
            S("dining.items", "Items ordered", Num(r.Get("order_items"))),
            S("dining.tips", "Tipped on orders", Money(r.Get("tip_cents"))),
            S("dining.drinks", "Drinks logged", Num(r.Get("drinks"))),
            S("dining.drinkKinds", "Different drinks logged", Num(r.Get("drink_kinds"))),
        };
        if (r.Text("venue") is { Length: > 0 } v) items.Add(S("dining.fav", "Your favourite restaurant", v));
        if (r.Text("dish") is { Length: > 0 } d) items.Add(S("dining.dish", "The thing you order most", d));
        if (r.Text("drink") is { Length: > 0 } dr) items.Add(S("dining.drink", "Your usual drink", Nice(dr)));
        if (r.Get("dinner_earliest") >= 0) items.Add(S("dining.earliest", "Earliest dinner you booked", TimeOfDay(r.Get("dinner_earliest"))));
        if (r.Get("dinner_latest") >= 0) items.Add(S("dining.latest", "Latest dinner you booked", TimeOfDay(r.Get("dinner_latest"))));
        items.Add(J("dining.second", "Second helpings considered", Num(r.Get("order_items") + r.Get("dinners") * 2 + Roll(seed, "second", 3, 20))));
        items.Add(J("dining.menu", "Menu pages read like a thriller", Num(r.Get("dinners") * 4 + Roll(seed, "menu", 2, 12))));
        items.Add(J("dining.sauce", "Sauces dipped into without asking", Num(Roll(seed, "sauce", 4, 33))));
        return Sec("dining", "Eating and drinking", "Where you eat, what you order and what you sip.", "🍽️", items);
    }

    private static StatSection Shows(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("shows.shows", "Show tickets", Num(r.Get("shows"))),
            S("shows.plan", "Events on your plan", Num(r.Get("plan_events"))),
            S("shows.hours", "Hours of events planned", $"{(r.Get("event_minutes") / 60.0).ToString("N1", En)}"),
            S("shows.longest", "Longest event on your plan", $"{Num(r.Get("longest_event"))} minutes"),
            S("shows.kinds", "Different kinds of event", Num(r.Get("event_kinds"))),
        };
        if (r.Text("event_kind") is { Length: > 0 } k) items.Add(S("shows.fav", "Your favourite kind of event", k));
        items.Add(J("shows.clap", "Claps clapped (estimated, enthusiastic)", Num(r.Get("shows") * 140 + Roll(seed, "clap", 20, 300))));
        items.Add(J("shows.encore", "Encores you personally caused", Num(Roll(seed, "encore", 0, 3))));
        items.Add(J("shows.seat", "Seats you swore were yours", Num(Roll(seed, "seat", 0, 4))));
        return Sec("shows", "Shows and events", "Entertainment you planned and tickets you hold.", "🎭", items);
    }

    private static StatSection Ashore(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("ashore.tours", "Excursions booked", Num(r.Get("tours"))),
            S("ashore.ports", "Ports with an excursion", Num(r.Get("tour_ports"))),
            S("ashore.hours", "Hours on excursions", $"{(r.Get("tour_minutes") / 60.0).ToString("N1", En)}"),
            S("ashore.walk", "Walking planned on excursions", $"{(r.Get("tour_walk_tenths") / 10.0).ToString("N1", En)} km"),
            S("ashore.spend", "Spent on excursions", Money(r.Get("tour_cents"))),
            S("ashore.tender", "Excursions that need a tender boat", Num(r.Get("tours_tender"))),
        };
        if (r.Text("port") is { Length: > 0 } p) items.Add(S("ashore.fav", "Your favourite port", p));
        if (r.Text("tour") is { Length: > 0 } t) items.Add(S("ashore.favTour", "Your most booked excursion", t));
        items.Add(J("ashore.souvenir", "Fridge magnets you will definitely buy", Num(Roll(seed, "magnet", 2, 14))));
        items.Add(J("ashore.selfie", "Selfies with a landmark in the background", Num(r.Get("tours") * 6 + Roll(seed, "selfie", 3, 25))));
        items.Add(J("ashore.lost", "Times you were certain the ship was left", Num(Roll(seed, "left", 0, 3)), "It always waits"));
        return Sec("ashore", "Ports and excursions", "The places you go when the ship stops.", "🏝️", items);
    }

    private static StatSection Spa(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("spa.visits", "Spa appointments", Num(r.Get("spa"))),
            S("spa.minutes", "Minutes of pampering", Num(r.Get("spa_minutes"))),
            S("spa.kinds", "Different treatments", Num(r.Get("spa_kinds"))),
            S("spa.spend", "Spent on the spa", Money(r.Get("spa_cents"))),
            J("spa.calm", "Calm achieved", $"{Roll(seed, "calm", 71, 99)}%", "Peaks at the second cucumber slice"),
            J("spa.robe", "Robe-to-person fit", Pick(seed, "robe", "Excellent", "Generous", "Tent-like", "Surprisingly stylish")),
            J("spa.whale", "Whale sounds hummed along to", Num(Roll(seed, "whale", 0, 6))),
        };
        return Sec("spa", "Spa and wellness", "Treatments, minutes and money.", "🧖", items);
    }

    private static StatSection Spending(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("money.charges", "Charges to your onboard account", Num(r.Get("folio_lines"))),
            S("money.total", "Total charged", Money(r.Get("folio_cents"))),
            S("money.biggest", "Your biggest single charge", Money(r.Get("folio_max"))),
            S("money.credits", "Credits and refunds received", Money(r.Get("folio_credit_cents"))),
            S("money.days", "Days you had a charge", Num(r.Get("folio_days"))),
            S("money.avg", "Average per day with a charge", r.Get("folio_days") > 0 ? Money(r.Get("folio_cents") / r.Get("folio_days")) : "Not yet"),
        };
        if (r.Text("spend_category") is { Length: > 0 } c) items.Add(S("money.top", "Where most of it went", c));
        items.Add(J("money.coins", "Loose change found in a coat pocket", $"${Roll(seed, "coins", 1, 9)}.{Roll(seed, "coins2", 10, 95)}"));
        items.Add(J("money.regret", "Purchases you regret", $"{Roll(seed, "regret", 0, 1)}", "Zero, and one was a snow globe"));
        items.Add(J("money.worth", "Value of the memories made", "Priceless", "No refunds on this one"));
        return Sec("money", "Money and spending", "What passed through your onboard account.", "💳", items);
    }

    private static StatSection Voyages(StatsRaw r, DateTime now, uint seed)
    {
        var totalNights = r.Get("nights") + r.Get("past_nights");
        var items = new List<StatItem>
        {
            S("voyages.bookings", "Voyages booked", Num(r.Get("bookings"))),
            S("voyages.nights", "Nights on the water", Num(totalNights), "Booked and past voyages together"),
            S("voyages.longest", "Your longest voyage", $"{Num(r.Get("longest_trip"))} nights"),
            S("voyages.past", "Earlier voyages on record", Num(r.Get("past_trips"))),
            S("voyages.ships", "Different ships", Num(r.Get("ships"))),
            S("voyages.ports", "Ports on your itineraries", Num(r.Get("ports"))),
            S("voyages.countries", "Countries on your itineraries", Num(r.Get("countries"))),
            S("voyages.companions", "People sailing with you", Num(r.Get("companions"))),
        };
        if (r.Date("next_departure_at") is { } next) items.Add(S("voyages.next", "Next departure", next.ToString("MMMM d, yyyy", En), $"In {Days(Math.Max(0, (int)(next.Date - now.Date).TotalDays))}"));
        if (r.Date("last_trip_at") is { } last) items.Add(S("voyages.last", "Most recent voyage", last.ToString("MMMM d, yyyy", En), $"{Days(Math.Max(0, (int)(now.Date - last.Date).TotalDays))} ago"));
        if (r.Date("first_past_trip_at") is { } first) items.Add(S("voyages.first", "Your first voyage on record", first.ToString("MMMM yyyy", En)));
        items.Add(J("voyages.waves", "Waves personally waved at", Num(totalNights * 40 + Roll(seed, "waves", 10, 90))));
        items.Add(J("voyages.sea", "Sea legs rating", Pick(seed, "legs", "Steady", "Wobbly but proud", "Born to it", "Prefers the buffet queue")));
        items.Add(J("voyages.horizon", "Hours spent staring at the horizon", Num(totalNights * 2 + Roll(seed, "horizon", 1, 10))));
        return Sec("voyages", "Your voyages", "Everything about where you have sailed and where you are going.", "🚢", items);
    }

    private static StatSection Ready(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("ready.checklist", "Checklist items ticked", Num(r.Get("checklist"))),
            S("ready.packed", "Things you packed", Num(r.Get("packed"))),
            S("ready.favourites", "Favourites saved", Num(r.Get("favourites"))),
            S("ready.celebrations", "Celebrations noted", Num(r.Get("celebrations"))),
            S("ready.feedback", "Times you sent feedback", Num(r.Get("feedback"))),
            S("ready.thanks", "Thank-you notes sent to crew", Num(r.Get("thanks_sent"))),
            S("ready.uploads", "Pictures you uploaded", Num(r.Get("uploads"))),
            S("ready.album", "Photos in your album", Num(r.Get("album"))),
            J("ready.socks", "Spare socks packed, just in case", Num(Roll(seed, "socks", 3, 19))),
            J("ready.charger", "Chargers you will forget anyway", Num(Roll(seed, "charger", 1, 3))),
            J("ready.suitcase", "Suitcase zip stress level", Pick(seed, "zip", "Calm", "Sitting on it", "Asking a friend to sit on it", "Two bags, no regrets")),
        };
        return Sec("ready", "Getting ready", "Planning, packing and small kindnesses.", "🧳", items);
    }

    private static StatSection Ship(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("ship.requests", "Service requests", Num(r.Get("requests"))),
            S("ship.laundry", "Laundry orders", Num(r.Get("laundry")), $"{Num(r.Get("laundry_items"))} items"),
            S("ship.wifi", "Devices on the ship's wifi", Num(r.Get("wifi_devices"))),
            S("ship.data", "Wifi data used", r.Get("wifi_mb") >= 1024 ? $"{(r.Get("wifi_mb") / 1024.0).ToString("N1", En)} GB" : $"{Num(r.Get("wifi_mb"))} MB"),
            S("ship.photos", "Photo packages bought", Num(r.Get("photo_packs"))),
            J("ship.lifts", "Lift buttons pressed twice, to be sure", Num(Roll(seed, "lift", 8, 120))),
            J("ship.decks", "Decks you could find with your eyes shut", Num(Roll(seed, "decks", 2, 6))),
            J("ship.lounger", "Loungers you have eyed up", Num(Roll(seed, "lounger", 4, 40))),
        };
        return Sec("ship", "Around the ship", "Requests, laundry, wifi and photos.", "🛟", items);
    }

    private static StatSection Social(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            S("social.companions", "People sailing with you", Num(r.Get("companions"))),
            S("social.friends", "Chat friends", Num(r.Get("connections"))),
            S("social.family", "Family links open", Num(r.Get("family_links")), "People at home who can follow along"),
            S("social.reactions", "Reactions exchanged", Num(r.Get("reacts_given") + r.Get("reacts_got"))),
            J("social.waves", "Strangers waved at in a corridor", Num(Roll(seed, "stranger", 5, 60))),
            J("social.names", "Names you promised to remember", Num(Roll(seed, "names", 3, 25)), "Remembered: four"),
            J("social.karaoke", "Karaoke songs you secretly know every word to", Num(Roll(seed, "karaoke", 2, 17))),
        };
        return Sec("social", "Friends and family", "The people around your cruise.", "👨‍👩‍👧", items);
    }

    // ---- badges ---------------------------------------------------------------------------------------------------------------------

    private static StatSection Records(StatsRaw r, DateOnly today)
    {
        var (_, longest) = Streaks(r.Days, today);
        var routes = r.Counters.Count(c => c.Key.StartsWith("route.", StringComparison.Ordinal) && c.Value > 0);
        var badges = new (string Name, bool Earned)[]
        {
            ("First Mate: signed in", r.Get("logins") >= 1),
            ("Regular: 10 sign-ins", r.Get("logins") >= 10),
            ("Fixture: 50 sign-ins", r.Get("logins") >= 50),
            ("Streaker: 3 days in a row", longest >= 3),
            ("Dedicated: 7 days in a row", longest >= 7),
            ("Night Owl: 10 minutes after midnight", Hours(r, 0, 4) >= 600),
            ("Early Bird: 10 minutes before 9 am", Hours(r, 5, 8) >= 600),
            ("Chatterbox: 50 messages", r.Get("msgs") >= 50),
            ("Shutterbug: 5 photos in chat", r.Get("chat_photos") >= 5),
            ("Hype Person: 25 reactions given", r.Get("reacts_given") >= 25),
            ("Beloved: 10 reactions received", r.Get("reacts_got") >= 10),
            ("Pin-worthy: a message pinned", r.Get("pinned") >= 1),
            ("Foodie: 3 different restaurants", r.Get("venues") >= 3),
            ("Specialty Seeker: 2 specialty dinners", r.Get("specialty") >= 2),
            ("Room Service Royalty: 5 room orders", r.Get("room_orders") >= 5),
            ("Mixologist: 5 different drinks", r.Get("drink_kinds") >= 5),
            ("Showgoer: 3 shows", r.Get("shows") >= 3),
            ("Explorer: 3 excursions", r.Get("tours") >= 3),
            ("Globetrotter: 3 countries", r.Get("countries") >= 3),
            ("Salty Sailor: 14 nights", r.Get("nights") + r.Get("past_nights") >= 14),
            ("Spa Regular: 2 appointments", r.Get("spa") >= 2),
            ("Planner: 10 checklist items", r.Get("checklist") >= 10),
            ("Collector: 10 favourites", r.Get("favourites") >= 10),
            ("Thoughtful: thanked the crew", r.Get("thanks_sent") >= 1),
            ("Curious Cat: 25 different screens", routes >= 25),
            ("Stanley's Friend: 10 questions", r.Get("asks") >= 10),
            ("Sharer: shared a stat", r.Counter("shares") >= 1),
        };
        var earned = badges.Where(b => b.Earned).Select(b => b.Name).ToList();
        var next = badges.FirstOrDefault(b => !b.Earned);
        var items = new List<StatItem>
        {
            S("records.badges", "Badges earned", $"{earned.Count} of {badges.Length}", earned.Count > 0 ? string.Join(" · ", earned) : "None yet. The first one is easy: just keep exploring."),
        };
        if (next.Name is not null) items.Add(S("records.next", "Next badge to chase", next.Name));
        items.Add(S("records.everything", "Everything you have done, added up", Num(Total(r)), "Messages, bookings, orders, tickets, checklist ticks and more"));
        return Sec("records", "Records and badges", "The milestones you have hit so far.", "🏅", items);
    }

    // ---- sections that are nothing but made-up -------------------------------------------------------------------------------------

    private static StatSection Buffet(StatsRaw r, uint seed)
    {
        var appetite = r.Get("dinners") * 37 + r.Get("orders") * 12 + r.Get("drinks") * 5;
        var items = new List<StatItem>
        {
            J("buffet.kcal", "Calories burned deciding what to eat", $"{Num(appetite + Roll(seed, "kcal", 200, 900))} kcal"),
            J("buffet.plates", "Plates balanced on one arm", Num(Roll(seed, "plates", 2, 6)), "One survived"),
            J("buffet.onemore", "Times you said just one more", Num(r.Get("drinks") + r.Get("dinners") + r.Get("order_items") + Roll(seed, "onemore", 3, 18))),
            J("buffet.ratio", "Dessert to vegetable ratio", Pick(seed, "ratio", "3 to 1", "7 to 1", "Dessert only, with a garnish", "Classified")),
            J("buffet.swans", "Napkins folded into swans", Num(Roll(seed, "swans", 0, 4))),
            J("buffet.walk", "Distance walked between the buffet and the same buffet", $"{Num(Roll(seed, "buffetwalk", 120, 980))} metres"),
            J("buffet.swirl", "Soft-serve swirl height record", $"{Roll(seed, "swirl", 6, 19)} cm"),
            J("buffet.chef", "Chance the chef recognises you", $"{Roll(seed, "chef", 61, 99)}%"),
        };
        return Sec("buffet", "Buffet science", "Entirely made up and scientifically unreviewed.", "🥞", items, true);
    }

    private static StatSection Seagulls(uint seed)
    {
        var items = new List<StatItem>
        {
            J("seagulls.names", "Seagulls who know your name", Num(Roll(seed, "gullname", 0, 7)), "They use a nickname"),
            J("seagulls.thefts", "Snack thefts survived", Num(Roll(seed, "theft", 0, 3))),
            J("seagulls.status", "Seagull diplomatic status", Pick(seed, "gull", "Neutral", "Allied", "Wary", "Fleeing")),
            J("seagulls.follow", "Distance a seagull followed you", $"{Num(Roll(seed, "follow", 40, 900))} metres, hopeful"),
            J("seagulls.hat", "Seagull opinion of your hat", Pick(seed, "hat", "Tempting", "Rude", "Fashion-forward", "Edible")),
            J("seagulls.chips", "Chips lost to the sea breeze", Num(Roll(seed, "chips", 3, 60))),
            J("seagulls.flaps", "Wing flaps per sandwich", Num(Roll(seed, "flaps", 4, 40))),
        };
        return Sec("seagulls", "Seagull relations", "Diplomacy with the local wildlife. Made up, like the rest of this section.", "🐦", items, true);
    }

    private static StatSection Privately(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            J("privately.nick", "Stanley's nickname for you", Pick(seed, "nick", "Captain Chaos", "The Navigator", "Deck Chair Legend", "Snack Admiral", "Chief Itinerary Officer", "Wanders-a-Lot")),
            J("privately.socks", "Stanley's confidence you packed enough socks", $"{Roll(seed, "stanleysocks", 12, 97)}%"),
            J("privately.asks", "Questions Stanley wanted to ask you back", Num(r.Get("asks") + Roll(seed, "askback", 2, 12))),
            J("privately.rating", "Stanley's rating of your life choices", Pick(seed, "choices", "Mostly harmless", "Inspiring", "Chaotic good", "Excellent, with notes")),
            J("privately.eyes", "Eye-rolls Stanley held back", Num(Roll(seed, "eyeroll", 0, 9)), "He has no eyes, he is an app"),
            J("privately.fav", "Stanley's favourite thing about you", Pick(seed, "favthing", "Your enthusiasm", "Your tipping", "Your snack choices", "Your taste in decks")),
            J("privately.name", "Times Stanley rehearsed your name", Num(Roll(seed, "rehearse", 3, 30))),
        };
        return Sec("privately", "What Stanley privately thinks", "Purely imagined. Stanley has not been consulted.", "🤫", items, true);
    }

    private static StatSection Cabin(StatsRaw r, uint seed)
    {
        var items = new List<StatItem>
        {
            J("cabin.search", "Minutes spent looking for your cabin", Num(Roll(seed, "findcabin", 4, 55) + (r.Get("bookings") == 0 ? 0 : 3))),
            J("cabin.corridor", "Corridor length walked", $"{Num(Roll(seed, "corridor", 300, 4200))} metres"),
            J("cabin.door", "Times you opened the wrong door with confidence", Num(Roll(seed, "wrongdoor", 0, 5))),
            J("cabin.towel", "Towel-to-floor ratio", Pick(seed, "floor", "Excellent", "Concerning", "Vertical", "Elevated")),
            J("cabin.phone", "Phone charger sighs", Num(Roll(seed, "sigh", 2, 11))),
            J("cabin.pillow", "Pillow fort stability", $"{Roll(seed, "fort", 60, 99)}%"),
            J("cabin.view", "Balcony view appreciation", Pick(seed, "balcony", "Reverent", "Chilly", "Dramatic", "Sunburnt")),
            J("cabin.lifts", "Lifts that arrived full", Num(Roll(seed, "fulllift", 2, 31)), "They were not full"),
        };
        return Sec("cabin", "Cabin physics", "Small laws of nature discovered at sea. All fiction.", "🛏️", items, true);
    }

    private static StatSection Fortune(DateOnly today, uint seed)
    {
        var day = today.DayNumber;
        var items = new List<StatItem>
        {
            J("fortune.deck", "Today's lucky deck", Num(Roll(seed, $"deck{day}", 2, 17))),
            J("fortune.number", "Today's lucky number", Num(Roll(seed, $"num{day}", 1, 99))),
            J("fortune.chance", "Chance of a great day", $"{Roll(seed, $"great{day}", 82, 100)}%"),
            J("fortune.fortune", "Today's fortune", Pick(seed, $"fortune{day}", "A pleasant surprise awaits near a pool", "Someone will compliment your shoes", "The queue will be shorter than it looks", "A snack will find you")),
            J("fortune.snack", "Recommended snack", Pick(seed, $"snack{day}", "Something warm and sugary", "A small cheese plate", "Soft-serve, obviously", "Fries to share, or not")),
            J("fortune.compass", "Compass advice", Pick(seed, $"compass{day}", "Go left", "Starboard looks promising", "Follow the smell of waffles", "Stay and have a nap")),
            J("fortune.ocean", "Mood of the ocean", Pick(seed, $"ocean{day}", "Dreamy", "Dramatic", "Mildly sarcastic", "Glittering")),
            J("fortune.animal", "Your sailing spirit animal", Pick(seed, "spirit", "Dolphin", "Pelican", "Sea otter", "Very confident penguin", "A buoy")),
        };
        return Sec("fortune", "Forecast and fortune", "Changes daily. Reliable in no way.", "🔮", items, true);
    }

    private static StatSection Towel(uint seed)
    {
        var items = new List<StatItem>
        {
            J("towel.count", "Towel animals that have watched you sleep", Num(Roll(seed, "towelcount", 1, 12))),
            J("towel.iq", "Towel animal IQ", Num(Roll(seed, "towelIq", 3, 140))),
            J("towel.name", "Your towel animal's name", Pick(seed, "towelname", "Gerald", "Sir Fluffington", "Terry", "Beatrice", "Dolores")),
            J("towel.wink", "Towel animals that winked back", Num(Roll(seed, "wink", 0, 2))),
            J("towel.dream", "Your towel animal's dream", Pick(seed, "toweldream", "To become a robe", "To see the horizon", "A longer trunk", "Nothing, it is a towel")),
            J("towel.move", "Chance it moved overnight", $"{Roll(seed, "towelmove", 3, 66)}%"),
            J("towel.fold", "Difficulty of folding your favourite", Pick(seed, "towelfold", "Easy", "Requires a YouTube video", "Witchcraft", "Mostly ears")),
        };
        return Sec("towel", "Towel animal intelligence", "A rigorous study with no methodology.", "🐘", items, true);
    }

    // ---- helpers --------------------------------------------------------------------------------------------------------------------

    private static StatItem S(string id, string label, string value, string? note = null, string? route = null) => new(id, label, value, note, false, route);
    private static StatItem J(string id, string label, string value, string? note = null) => new(id, label, value, note, true, null);
    private static StatSection Sec(string id, string title, string blurb, string icon, List<StatItem> stats, bool joke = false) => new(id, title, blurb, icon, joke, stats);

    private static string Num(long n) => n.ToString("N0", En);
    private static string Money(long cents) => (cents / 100m).ToString("C2", En);
    private static string Days(int n) => n == 1 ? "1 day" : $"{Num(n)} days";
    private static string TimeOfDay(long minutes) => DateTime.Today.AddMinutes(minutes).ToString("h:mm tt", En);
    private static string Nice(string id) { var t = id.Replace('-', ' ').Replace('_', ' '); return t.Length == 0 ? t : char.ToUpper(t[0], En) + t[1..]; }

    private static string Dur(long seconds)
    {
        if (seconds < 60) return $"{seconds} sec";
        if (seconds < 3600) return $"{seconds / 60} min";
        return $"{seconds / 3600}h {seconds % 3600 / 60}m";
    }

    private static long Active(StatsRaw r) => r.Days.Count;
    private static long Hours(StatsRaw r, int from, int to) { long s = 0; for (var h = from; h <= to; h++) s += r.Counter($"hour.{h:00}"); return s; }
    private static string HourName(int h) => DateTime.Today.AddHours(h).ToString("h tt", En).ToLowerInvariant();
    private static int Peak(StatsRaw r)
    {
        var best = -1; long most = 0;
        for (var h = 0; h < 24; h++) { var v = r.Counter($"hour.{h:00}"); if (v > most) { most = v; best = h; } }
        return best;
    }

    private static string? Weekday(List<StatsDay> days) => days.Count == 0 ? null
        : days.GroupBy(d => d.Day.DayOfWeek).OrderByDescending(g => g.Count()).ThenByDescending(g => g.Sum(d => d.Seconds)).ThenBy(g => g.Key).First().Key.ToString();

    private static string AreaName(string key) => key["area.".Length..] switch { "home" => "Home", "plan" => "Plan", "ship" => "Ship", "chat" => "Chat", "me" => "Me", var other => Nice(other) };

    /// <summary>The path a route counter stands for: <c>route.me.stats</c> is <c>/me/stats</c>.</summary>
    private static string RoutePath(string key) => "/" + key["route.".Length..].Replace('.', '/');

    private static long Total(StatsRaw r) => new[] { "msgs", "dinners", "orders", "drinks", "shows", "plan_events", "tours", "spa", "checklist", "packed", "favourites", "requests", "laundry", "uploads", "reacts_given" }.Sum(k => r.Get(k)) + r.Counter("views");

    /// <summary>The run of consecutive active days that ends today or yesterday (the device's day may be a day ahead or behind), and the longest run ever.</summary>
    internal static (int Current, int Longest) Streaks(List<StatsDay> days, DateOnly today)
    {
        var set = days.Select(d => d.Day).ToHashSet();
        var longest = 0;
        foreach (var d in set.Where(x => !set.Contains(x.AddDays(-1))))
        {
            var n = 1;
            while (set.Contains(d.AddDays(n))) n++;
            longest = Math.Max(longest, n);
        }
        var end = set.Contains(today) ? today : today.AddDays(-1);
        var current = 0;
        while (set.Contains(end.AddDays(-current))) current++;
        return (current, longest);
    }

    /// <summary>A number that never changes for a guest (FNV-1a over the guest's id and a name), so a made-up stat stays put between visits.</summary>
    private static uint Hash(uint seed, string salt)
    {
        var h = 2166136261u ^ seed;
        foreach (var c in salt) { h ^= c; h *= 16777619u; }
        h ^= h >> 15; h *= 2246822519u; h ^= h >> 13;
        return h;
    }

    private static uint Seed(Guid id) { var b = id.ToByteArray(); return BitConverter.ToUInt32(b, 0) ^ BitConverter.ToUInt32(b, 4) ^ BitConverter.ToUInt32(b, 8) ^ BitConverter.ToUInt32(b, 12); }
    internal static long Roll(uint seed, string salt, int low, int high) => low + Hash(seed, salt) % (uint)(high - low + 1);
    internal static string Pick(uint seed, string salt, params string[] options) => options[(int)(Hash(seed, salt) % (uint)options.Length)];

    /// <summary>The ids a client may count, and what shape they take: used to refuse anything else.</summary>
    internal static bool KnownCounter(string key, long value)
    {
        if (value < 0 || value > 100_000) return false;
        if (key is "opens" or "views" or "seconds" or "shares") return true;
        if (key.StartsWith("hour.", StringComparison.Ordinal)) return key.Length == 7 && int.TryParse(key.AsSpan(5), NumberStyles.None, CultureInfo.InvariantCulture, out var h) && h < 24;
        if (key.StartsWith("area.", StringComparison.Ordinal)) return key is "area.home" or "area.plan" or "area.ship" or "area.chat" or "area.me" or "area.other";
        return key.StartsWith("route.", StringComparison.Ordinal) && key.Length is > 6 and <= 40 && key.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '.' or '-') && key[6] != '.' && key[^1] != '.';
    }
}
