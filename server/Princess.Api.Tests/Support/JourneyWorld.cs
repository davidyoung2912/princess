using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Princess.Api.Contracts;
using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>
/// A small cruise world: the Harper family on PC243902 (Daniel books; Priya is an adult guest; Maya is a supervised child), a stranger on another booking,
/// a helper outside the booking, a guest with no booking, and an agent booking waiting to be linked. The clock is 12:00 ship time on 5 March 2027.
/// </summary>
public abstract class JourneyWorld : IDisposable
{
    protected const string Password = "Sailaway!2027";
    protected static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    protected readonly ApiFactory F = new();
    protected readonly HttpClient Http;
    protected readonly UserRecord Daniel, Priya, Maya, Stranger, Paul, Nina;
    protected readonly BookingRow Harper, Other, Agent;

    protected JourneyWorld()
    {
        Http = F.CreateClient();
        Daniel = F.Users.Add("daniel@demo.princess.example", Password, first: "Daniel");
        Priya = F.Users.Add("priya@demo.princess.example", Password, first: "Priya");
        Maya = F.Users.Add(null, null, supervised: true, booker: Daniel, first: "Maya");
        Stranger = F.Users.Add("stranger@demo.princess.example", Password, first: "Sam");
        Paul = F.Users.Add("paul@demo.princess.example", Password, first: "Paul");
        Nina = F.Users.Add("nina@demo.princess.example", Password, first: "Nina");

        Harper = AddBooking(10, "PC243902", Daniel, depositPaid: true, paid: 245_300, total: 1_226_300, [Daniel, Priya, Maya]);
        Other = AddBooking(11, "PC179254", Stranger, depositPaid: true, paid: 99_700, total: 497_000, [Stranger]);
        Agent = new BookingRow
        {
            BookingId = 12, Number = "AG7P31BK", Kind = "agent", AgentName = "Harbour Travel", BookerUserId = Nina.Id, SailingId = "sun-2027-03-21",
            SailingTitle = "Eastern Caribbean", ShipName = "Sun Princess", Departure = new DateTime(2027, 3, 21), Nights = 7, CategoryId = "balcony", CategoryName = "Balcony",
            FareId = "standard", Status = "confirmed", TotalCents = 400_000, DepositCents = 400_000, FinalDueDate = new DateTime(2026, 12, 21), ConfirmedAt = new DateTime(2026, 10, 1),
            GuestAccounts = 0, GuestDetails = 2, PaidCents = 400_000,
        };
        F.Journey.Bookings.Add(Agent);
        F.Journey.AgentLeads.Add((12, "Whitfield"));

        AddProfile(Daniel, "Daniel", "Harper", "1982-04-10", "daniel@demo.princess.example");
        AddProfile(Priya, "Priya", "Harper", "1984-06-02", "priya@demo.princess.example");
        AddProfile(Maya, "Maya", "Harper", "2018-09-30", "");
        AddProfile(Stranger, "Sam", "Stranger", "1970-01-01", "stranger@demo.princess.example");
        AddProfile(Paul, "Paul", "Abernathy", "1965-05-05", "paul@demo.princess.example");
        AddProfile(Nina, "Nina", "Castellano", "1990-02-02", "nina@demo.princess.example");

        SetNow(new DateTime(2027, 3, 5, 17, 0, 0, DateTimeKind.Utc));
        foreach (var g in F.Journey.Party[10]) g.Held.Clear();
        Held(Daniel, ("passport", new DateTime(2030, 2, 1)));
        Held(Priya, ("passport", new DateTime(2030, 2, 1)));
        Held(Maya, ("birthCertificate", null));
    }

    /// <summary>
    /// Moves everyone's "now" with the demo clock (D4). Tokens are validated against real time, so the pipeline clock stays real and each person is a demo user with an offset,
    /// exactly how the persona seeds work.
    /// </summary>
    protected void SetNow(DateTime utc)
    {
        foreach (var u in F.Users.Users)
        {
            u.IsDemo = true;
            F.Journey.ClockOffsets[u.Id] = (long)Math.Round((utc - F.Clock.UtcNow).TotalSeconds);
        }
    }

    private BookingRow AddBooking(long id, string number, UserRecord booker, bool depositPaid, long paid, long total, UserRecord[] guests)
    {
        var b = new BookingRow
        {
            BookingId = id, Number = number, Kind = "direct", BookerUserId = booker.Id, SailingId = "sun-2027-03-21", SailingTitle = "Eastern Caribbean", ShipName = "Sun Princess",
            Departure = new DateTime(2027, 3, 21), Nights = 7, CategoryId = "balcony", CategoryName = "Balcony", FareId = "plus", Status = "confirmed",
            TotalCents = total, DepositCents = paid, FinalDueDate = new DateTime(2027, 3, 11), ConfirmedAt = new DateTime(2026, 10, 22, 15, 0, 0), GuestAccounts = guests.Length,
            PaidCents = depositPaid ? paid : 0,
        };
        F.Journey.Bookings.Add(b);
        F.Journey.Payments.Add((id, new PaymentRow { PublicId = Guid.NewGuid(), Label = "deposit", AmountCents = paid, At = new DateTime(2026, 10, 22, 15, 0, 0), Method = "card", CardBrand = "visa", Last4 = "4242" }, booker.Id));
        F.Journey.Party[id] = guests.Select((u, i) => new GuestRow
        {
            UserId = u.Id, PublicId = u.PublicId, FirstName = u.FirstName!, LastName = "x", Dob = new DateTime(1980, 1, 1), IsSupervised = u.IsSupervised, BookerUserId = u.BookerUserId, Seq = i + 1,
        }).ToList();
        foreach (var u in guests) F.Access.Members.Add((u.Id, new BookingMembership { BookingId = id, Number = number, BookerUserId = booker.Id, IsLead = u == booker }));
        F.Journey.Cards.Add((booker.Id, new CardRow { Id = id * 100, PublicId = Guid.NewGuid(), Brand = "visa", Last4 = "4242", Expiry = "09/29" }));
        return b;
    }

    private void AddProfile(UserRecord u, string first, string last, string dob, string email)
    {
        F.Journey.Profiles[u.Id] = new ProfileRecord
        {
            UserId = u.Id, FirstName = first, LastName = last, Dob = DateTime.Parse(dob), Email = email, Phone = u.IsSupervised ? "" : "555-0103",
            EmergencyName = u.IsSupervised ? "" : "Sam Example", EmergencyPhone = u.IsSupervised ? "" : "555-0104", EmergencyRelationship = u.IsSupervised ? "" : "Friend",
        };
        foreach (var g in F.Journey.Party.Values.SelectMany(p => p).Where(g => g.UserId == u.Id))
        {
            g.FirstName = first;
            g.LastName = last;
            g.Dob = DateTime.Parse(dob);
        }
    }

    protected void Held(UserRecord u, params (string Doc, DateTime? Expires)[] docs)
    {
        foreach (var g in F.Journey.Party.Values.SelectMany(p => p).Where(g => g.UserId == u.Id))
        {
            g.Held.Clear();
            foreach (var (doc, expires) in docs) g.Held[doc] = expires;
        }
    }

    protected GuestRow GuestOf(UserRecord u) => F.Journey.Party[10].Single(g => g.UserId == u.Id);

    protected string MayaToken() => ViewAsToken(Daniel, Maya).GetAwaiter().GetResult();

    protected async Task<string> SignIn(UserRecord u)
    {
        var r = await Http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(u.Email, Password));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return (await r.Content.ReadFromJsonAsync<SessionResponse>(Web))!.AccessToken;
    }

    protected async Task<string> ViewAsToken(UserRecord booker, UserRecord child)
    {
        var token = await SignIn(booker);
        var r = await Call(HttpMethod.Post, $"/api/v1/me/view-as/{child.PublicId}", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        return r.Json.GetProperty("accessToken").GetString()!;
    }

    protected sealed record Reply(HttpStatusCode Status, JsonElement Json, string? ProblemType, string? ProblemTitle);

    protected async Task<Reply> Call(HttpMethod method, string url, string? token = null, object? body = null)
    {
        var req = new HttpRequestMessage(method, url);
        if (token is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body);
        var res = await Http.SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        var json = text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone();
        var problem = res.Content.Headers.ContentType?.MediaType == "application/problem+json";
        return new Reply(res.StatusCode, json, problem ? json.GetProperty("type").GetString() : null, problem ? json.GetProperty("title").GetString() : null);
    }

    protected Task<Reply> Get(string url, string? token) => Call(HttpMethod.Get, url, token);

    public void Dispose()
    {
        Http.Dispose();
        F.Dispose();
        GC.SuppressFinalize(this);
    }
}
