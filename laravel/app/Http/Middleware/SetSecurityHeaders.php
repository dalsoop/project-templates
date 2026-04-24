<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class SetSecurityHeaders
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = config('project.security_headers');

        if (! \is_array($headers)) {
            return $response;
        }

        foreach ($headers as $name => $value) {
            if (! \is_string($name) || ! \is_string($value) || trim($value) === '') {
                continue;
            }

            $response->headers->set($name, $value);
        }

        return $response;
    }
}
