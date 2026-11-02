using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>N8.1 and N8.2: the guard around a real provider, and the Open-Meteo weather provider falling back to the simulation.</summary>
public class ProviderGuardTests
{
    private sealed class Clock : IClock { public DateTime UtcNow { get; set; } = new(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc); }

    private sealed class Factory(Func<HttpRequestMessage, HttpResponseMessage> answer) : IHttpClientFactory
    {
        public int Calls;
        public HttpClient CreateClient(string name) => new(new Handler(this, answer));
    }

    private sealed class Handler(Factory f, Func<HttpRequestMessage, HttpResponseMessage> answer) : HttpMessageHandler
    {
        protected override HttpResponseMessage Send(HttpRequestMessage r, CancellationToken ct) { f.Calls++; return answer(r); }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct) => Task.FromResult(Send(r, ct));
    }

    private const string Good = """{"daily":{"uv_index_max":[10.4],"temperature_2m_max":[86.2]},"hourly":{"precipitation_probability":[0,0,0,0,0,0,0,0,0,0,0,0,0,60,70,0,0,0,0,0,0,0,0,0]}}""";

    [Fact]
    public void ACircuitOpensAfterRepeatedFailuresAndClosesAfterATrial()
    {
        var clock = new Clock();
        var guard = new ProviderGuard("T", clock, NullLogger.Instance, 2, TimeSpan.FromMinutes(1));
        var real = 0;
        string? Fail() { real++; throw new HttpRequestException("down"); }
        Assert.Equal("sim", guard.Run(Fail, () => "sim"));
        Assert.Equal("sim", guard.Run(Fail, () => "sim"));
        Assert.True(guard.IsOpen);
        Assert.Equal("sim", guard.Run(Fail, () => "sim"));
        Assert.Equal(2, real);            // open: the real call was not made
        clock.UtcNow = clock.UtcNow.AddMinutes(2);
        Assert.Equal("real", guard.Run(() => "real", () => "sim"));
        Assert.False(guard.IsOpen);
        Assert.Equal(0, guard.Failures);
    }

    [Fact]
    public void ANullAnswerFallsBack() =>
        Assert.Equal("sim", new ProviderGuard("T", new Clock(), NullLogger.Instance).Run<string>(() => null, () => "sim"));

    [Fact]
    public void ParseReadsUvTemperatureAndTheRainWindow()
    {
        var sky = OpenMeteoWeatherService.Parse(Good)!;
        Assert.Equal(10, sky.Uv);
        Assert.Equal(86, sky.TempF);
        Assert.Equal("13:00", sky.RainFrom);
        Assert.Equal("15:00", sky.RainTo);
        Assert.Equal("forecast", sky.Source);
        Assert.Null(OpenMeteoWeatherService.Parse("{}"));
        Assert.Null(OpenMeteoWeatherService.Parse("not json"));
    }

    private static OpenMeteoWeatherService Service(Factory f, Clock clock) =>
        new(f, Options.Create(new OpenMeteoOptions()), clock, NullLogger<OpenMeteoWeatherService>.Instance);

    [Fact]
    public void ARealForecastIsUsedForAKnownPortInWindow()
    {
        var clock = new Clock();
        var f = new Factory(_ => new HttpResponseMessage { Content = new StringContent(Good) });
        Assert.Equal("forecast", Service(f, clock).Sky(new DateOnly(2027, 3, 5), "cozumel").Source);
    }

    [Fact]
    public void SeaDaysAndFarDatesAreSimulatedWithoutACall()
    {
        var clock = new Clock();
        var f = new Factory(_ => new HttpResponseMessage { Content = new StringContent(Good) });
        var svc = Service(f, clock);
        Assert.Equal("sim", svc.Sky(new DateOnly(2027, 3, 5), "sea").Source);
        Assert.Equal("sim", svc.Sky(new DateOnly(2027, 9, 5), "cozumel").Source);
        Assert.Equal(0, f.Calls);
    }

    [Fact]
    public void AFailingProviderFallsBackAndThenStopsBeingCalled()
    {
        var clock = new Clock();
        var f = new Factory(_ => new HttpResponseMessage(System.Net.HttpStatusCode.InternalServerError));
        var svc = Service(f, clock);
        for (var i = 0; i < 6; i++) Assert.Equal("sim", svc.Sky(new DateOnly(2027, 3, 5), "fll").Source);
        Assert.Equal(3, f.Calls);
    }

    [Fact]
    public void ConfigurationSwitchesWeatherToOpenMeteo()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Providers:Weather"] = "openmeteo" }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IClock, Clock>();
        services.AddSingleton<IDbConnectionFactory>(_ => throw new InvalidOperationException());
        services.AddProviders(config);
        using var sp = services.BuildServiceProvider();
        Assert.IsType<OpenMeteoWeatherService>(sp.GetRequiredService<IWeatherService>());
    }
}
