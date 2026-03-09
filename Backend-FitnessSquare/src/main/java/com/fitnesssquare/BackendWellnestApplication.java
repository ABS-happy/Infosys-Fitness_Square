package com.fitnesssquare;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
public class BackendWellnestApplication {

	public static void main(String[] args) {
        System.out.println("================================================");
        System.out.println(">>> FITNESS SQUARE SERVER STARTING...         <<<");
        System.out.println("================================================");
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        dotenv.entries().forEach(entry -> System.setProperty(entry.getKey(), entry.getValue()));

        SpringApplication.run(BackendWellnestApplication.class, args);
    }

    @Bean
    public CommandLineRunner endpointLogger(ApplicationContext ctx) {
        return args -> {
            RequestMappingHandlerMapping mapping = ctx.getBean(RequestMappingHandlerMapping.class);
            System.out.println(">>> REGISTERED ENDPOINTS:");
            mapping.getHandlerMethods().forEach((key, value) -> System.out.println(">>> " + key + " -> " + value));
        };
    }

}
