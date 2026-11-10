using Princess.Api.Realtime;

namespace Princess.Api.Tests;

/// <summary>Live connection bookkeeping (docs/chat-plan.md, phase 3). Written, not run here: the owner runs the server tests.</summary>
public class RealtimeStateTests
{
    [Fact]
    public void A_person_is_connected_until_their_last_app_closes()
    {
        var s = new RealtimeState();
        var id = Guid.NewGuid();
        Assert.False(s.IsConnected(id));
        s.Connected(id); s.Connected(id);
        s.Disconnected(id);
        Assert.True(s.IsConnected(id));
        s.Disconnected(id);
        Assert.False(s.IsConnected(id));
        s.Disconnected(id);   // an extra close is harmless
        Assert.False(s.IsConnected(id));
    }

    [Fact]
    public async Task An_acknowledgement_before_the_wait_ends_is_heard()
    {
        var s = new RealtimeState();
        using var w = s.Expect("k1");
        s.Ack("k1");
        Assert.True(await w.WaitAsync(TimeSpan.FromSeconds(5), CancellationToken.None));
    }

    [Fact]
    public async Task No_acknowledgement_times_out_and_unknown_ids_are_ignored()
    {
        var s = new RealtimeState();
        s.Ack("nobody");
        using var w = s.Expect("k2");
        Assert.False(await w.WaitAsync(TimeSpan.FromMilliseconds(30), CancellationToken.None));
    }

    [Fact]
    public void A_finished_wait_is_forgotten()
    {
        var s = new RealtimeState();
        var w = s.Expect("k3");
        Assert.Equal(1, s.Waiting);
        w.Dispose();
        Assert.Equal(0, s.Waiting);
    }
}
