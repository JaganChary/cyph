package main

import (
	"regexp"
	"time"
)

var config = struct {
	AllowedCyphIds             *regexp.Regexp
	AllowedCyphIdLength        int
	AllowedMethods             string
	AllowedHosts               map[string]none
	ApiKeyByteLength           int
	Continents                 map[string]none
	DefaultContinent           string
	EmailAddress               string
	HSTSHeader                 string
	MaxChannelDescriptorLength int
	MaxSignupValueLength       int
	MemcacheExpiration         time.Duration
	NewCyphTimeout             int64
	Plans                      map[string]Plan
	RootURL                    string
}{
	regexp.MustCompile("[A-Za-z0-9]{7}"),

	7,

	"GET,HEAD,POST,PUT,DELETE,OPTIONS",

	map[string]none{
		"cyph.com":                                      empty,
		"www.cyph.com":                                  empty,
		"cyph.ws":                                       empty,
		"cyph.im":                                       empty,
		"www.cyph.im":                                   empty,
		"cyph.me":                                       empty,
		"www.cyph.me":                                   empty,
		"cyph.video":                                    empty,
		"www.cyph.video":                                empty,
		"cyph.audio":                                    empty,
		"www.cyph.audio":                                empty,
		"api.cyph.com":                                  empty,
		"cyphdbyhiddenbhs.onion":                        empty,
		"www.cyphdbyhiddenbhs.onion":                    empty,
		"im.cyphdbyhiddenbhs.onion":                     empty,
		"me.cyphdbyhiddenbhs.onion":                     empty,
		"video.cyphdbyhiddenbhs.onion":                  empty,
		"audio.cyphdbyhiddenbhs.onion":                  empty,
		"api.cyphdbyhiddenbhs.onion":                    empty,
		"prod-dot-default-dot-cyphme.appspot.com":       empty,
		"staging-dot-cyph-com-dot-cyphme.appspot.com":   empty,
		"staging-dot-cyph-im-dot-cyphme.appspot.com":    empty,
		"staging-dot-cyph-me-dot-cyphme.appspot.com":    empty,
		"staging-dot-cyph-video-dot-cyphme.appspot.com": empty,
		"staging-dot-cyph-audio-dot-cyphme.appspot.com": empty,
		"staging-dot-cyphme.appspot.com":                empty,
	},

	16,

	map[string]none{
		"af": empty,
		/* "an": empty, */
		"as": empty,
		"eu": empty,
		"na": empty,
		"oc": empty,
		"sa": empty,
	},

	"eu",

	"Cyph <hello@cyph.com>",

	"max-age=31536000; includeSubdomains; preload",

	90,

	/* Max length of a valid email address, but also happened
	to seem like a sane limit for the other values */
	256,

	(48 * time.Hour),

	600,

	map[string]Plan{
		"2-0": Plan{
			ProFeatures: map[string]bool{
				"api":            true,
				"disableP2P":     true,
				"modestBranding": true,
				"nativeCrypto":   true,
				"telehealth":     false,
				"video":          true,
				"voice":          true,
			},
			SessionCountLimit: -1,
		},
		"2-1": Plan{
			ProFeatures: map[string]bool{
				"api":            true,
				"disableP2P":     false,
				"modestBranding": false,
				"nativeCrypto":   false,
				"telehealth":     false,
				"video":          false,
				"voice":          false,
			},
			SessionCountLimit: 100,
		},
		"3-0": Plan{
			ProFeatures: map[string]bool{
				"api":            true,
				"disableP2P":     false,
				"modestBranding": true,
				"nativeCrypto":   false,
				"telehealth":     true,
				"video":          true,
				"voice":          true,
			},
			SessionCountLimit: 100,
		},
		"3-1": Plan{
			ProFeatures: map[string]bool{
				"api":            true,
				"disableP2P":     false,
				"modestBranding": true,
				"nativeCrypto":   false,
				"telehealth":     true,
				"video":          true,
				"voice":          true,
			},
			SessionCountLimit: 1000,
		},
	},

	"http://localhost:42000",
}
